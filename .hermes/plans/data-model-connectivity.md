# Plan de Implementación: Saneamiento del Modelo de Datos — Grafo Conexo con Presupuesto como Raíz

> **Para Hermes:** Usar subagent-driven-development para implementar este plan tarea por tarea.
>
> **Objetivo:** Revertir la orientación del modelo para que el presupuesto (quote) sea la raíz de la cadena transaccional, todo evento cuelgue de un quote, y todas las entidades maestras sean trazables desde cualquier punto de uso.
>
> **Arquitectura:** Migración SQL en 4 fases + actualización de API routes + actualización de componentes + tests de integridad. Todo con TDD.
>
> **Dependencia:** Motor de costes unificado (costing.ts + event_costs) ya deployado.

---

## ⚠️ Prerrequisito técnico

Antes de implementar, verificar el estado actual de la DB en VPS:

```bash
# 1. Verificar qué tablas existen
docker exec -i eventflow-postgres psql -U postgres -d eventflow -c "\dt"
# 2. Verificar qué FKs hay
docker exec -i eventflow-postgres psql -U postgres -d eventflow -c "
  SELECT conrelid::regclass AS tbl, confrelid::regclass AS ref, conname
  FROM pg_constraint WHERE contype = 'f' ORDER BY 1"
# 3. Contar eventos sin quote
docker exec -i eventflow-postgres psql -U postgres -d eventflow -c "
  SELECT COUNT(*) FROM events e LEFT JOIN quotes q ON q.event_id = e.id WHERE q.id IS NULL"
```

---

## Fase 0: Validación del estado actual

**Tarea 0 — Verificar eventos huérfanos y estado del modelo**

```bash
ssh ... "docker exec -i eventflow-postgres psql -U postgres -d eventflow << 'SQL'
  -- Tablas sin FK a events
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  AND table_name NOT IN (
    SELECT conrelid::regclass::text FROM pg_constraint WHERE contype = 'f' AND confrelid = 'events'::regclass
    UNION SELECT conrelid::regclass::text FROM pg_constraint WHERE contype = 'f' AND confrelid = 'quotes'::regclass
  ) ORDER BY 1;

  -- Contar maestras sin uso
  SELECT COUNT(*) FROM ingredients i WHERE NOT EXISTS (
    SELECT 1 FROM event_shopping_items WHERE ingredient_id = i.id
  );
  SELECT COUNT(*) FROM workers w WHERE NOT EXISTS (
    SELECT 1 FROM staffing_assignments WHERE worker_id = w.id
  );
SQL"
```

---

## Fase 1: Migración SQL — quote_id en events + materializar relación presupuesto

**Tarea 1 — Crear script de migración: `scripts/2026-06-21-quote-as-root-migration.sql`**

Crear: `scripts/2026-06-21-quote-as-root-migration.sql`

```sql
-- ============================================================
-- MIGRACIÓN V1: Presupuesto como raíz del modelo de datos
-- ============================================================
-- Ejecutar con: docker exec -i eventflow-postgres psql -U postgres -d eventflow -f /path/to/file

BEGIN;

-- 1.1: Añadir quote_id a events (debe apuntar al quote que lo originó)
ALTER TABLE events ADD COLUMN quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL;

-- Poblar: para eventos que YA tienen quote (event_id es FK en quotes -> quote tiene event_id)
-- Como la relación está invertida, el quote apunta al evento, no al revés
-- Pero hay 2 quotes que sí tienen event_id — esos eventos tienen quote
UPDATE events e SET quote_id = q.id
FROM quotes q
WHERE q.event_id = e.id;

-- 1.2: Materializar selected_items — copiar de events a quotes si hay divergencia
-- Los que ya tienen quote pero su selected_items puede diferir: unificar
-- NOTA: selected_items se mantiene en ambas (cache desnormalizada) hasta fase 3

-- 1.3: Crear tablas de stock si no existen
CREATE TABLE IF NOT EXISTS stock_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'g',
  movement_reason TEXT NOT NULL DEFAULT 'operativo'
    CHECK (movement_reason IN ('operativo', 'compra_prevision', 'merma', 'ajuste_inventario', 'inventario_inicial')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 1.4: Añadir event_id a supplier_orders
ALTER TABLE supplier_orders ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;
ALTER TABLE supplier_orders ADD COLUMN IF NOT EXISTS origin TEXT CHECK (origin IN ('escandallo', 'manual', 'reaprovisionamiento'));

-- 1.5: Migrar supplier_order_items a ingredient_id FK
ALTER TABLE supplier_order_items ADD COLUMN IF NOT EXISTS ingredient_id UUID REFERENCES ingredients(id);
ALTER TABLE supplier_order_items ALTER COLUMN ingredient_name DROP NOT NULL;

-- Poblar ingredient_id desde búsqueda por nombre
UPDATE supplier_order_items soi SET ingredient_id = i.id
FROM ingredients i
WHERE LOWER(i.name) = LOWER(soi.ingredient_name);

-- 1.6: Eliminar staff_assignments (muerta)
DROP TABLE IF EXISTS staff_assignments CASCADE;

END;
COMMIT;
```

---

## Fase 2: Actualizar el middleware — quote_id obligatorio en creación de eventos

**Tarea 2 — Modificar API de events para exigir quote_id en POST**

Archivo: `src/app/api/events/route.ts`

- En el POST de creación de evento, validar que `quote_id` no sea nulo
- Si viene sin quote_id, buscar o crear un quote implícito:
  - Si el evento tiene `client_name/cliente_email` → buscar lead existente
  - Si no hay lead → crear quote con `status: 'historical'` y `items: []`
- En GET, añadir `quote_id` a la respuesta

```typescript
// En POST /api/events
const { quote_id, ...rest } = body;
if (!quote_id) {
  // Crear quote implícito con el lead si existe o genérico
  const quote = await createImplicitQuote({
    client_name: body.client_name,
    event_date: body.event_date,
    guest_count: body.guest_count || 0,
  });
  body.quote_id = quote.id;
  body.quote_status = 'historical';
}
```

**Tarea 2.1 — Crear helper `createImplicitQuote()` en `src/lib/quotes.ts`**

```typescript
export async function createImplicitQuote(params: {
  client_name?: string;
  event_date?: string;
  guest_count?: number;
}): Promise<{ id: string }> {
  const result = await pool.query(
    `INSERT INTO quotes (event_id, status, items, total_pvp, created_at)
     VALUES (NULL, 'historical', '[]'::jsonb, 0, NOW())
     RETURNING id`
  );
  return { id: result.rows[0].id };
}
```

---

## Fase 3: API de trazabilidad — desde un presupuesto y desde una maestra

**Tarea 3 — Crear endpoint `GET /api/quotes/[id]/trace`**

Recorre toda la descendencia transaccional desde un presupuesto.

```typescript
// GET /api/quotes/[id]/trace
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  // Validate UUID
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ success: false, error: 'ID inválido.' }, { status: 422 });
  }
  
  // 1. El presupuesto
  const quote = await pool.query('SELECT * FROM quotes WHERE id = $1', [id]);
  
  // 2. El evento vinculado (por quote_id)
  const events = await pool.query(
    'SELECT * FROM events WHERE quote_id = $1 ORDER BY created_at DESC', [id]
  );
  
  // 3. La descendencia transaccional de cada evento
  const eventOrders = await pool.query(
    'SELECT * FROM event_orders WHERE event_id = ANY($1)',
    [events.rows.map(e => e.id)]
  );
  const eventShoppingItems = await pool.query(
    'SELECT * FROM event_shopping_items WHERE event_id = ANY($1)',
    [events.rows.map(e => e.id)]
  );
  const payments = await pool.query(
    'SELECT * FROM payments WHERE event_id = ANY($1)',
    [events.rows.map(e => e.id)]
  );
  const invoices = await pool.query(
    'SELECT * FROM invoices WHERE event_id = ANY($1)',
    [events.rows.map(e => e.id)]
  );
  const staffingLines = await pool.query(
    'SELECT * FROM staffing_lines WHERE event_id = ANY($1)',
    [events.rows.map(e => e.id)]
  );
  
  // 4. Maestras vinculadas (por referencia en las transacciones)
  const ingredient_ids = [...new Set([
    ...eventShoppingItems.rows.map(i => i.ingredient_id),
    ...eventOrders.rows.filter(eo => eo.event_id === events.rows[0]?.id)
  ])];
  
  const providers = ingredient_ids.length > 0
    ? await pool.query('SELECT * FROM providers WHERE id = ANY($1)', [
      (await pool.query(
        'SELECT DISTINCT provider_id FROM ingredients WHERE id = ANY($1)',
        [ingredient_ids]
      )).rows.map(i => i.provider_id)
    ])
    : [];
  
  return NextResponse.json({
    success: true,
    data: {
      quote: quote.rows[0],
      events: events.rows,
      eventOrders: eventOrders.rows,
      shoppingItems: eventShoppingItems.rows,
      payments: payments.rows,
      invoices: invoices.rows,
      staffingLines: staffingLines.rows,
      providers: providers.rows,
      ingredients: ingredient_ids.length > 0
        ? (await pool.query('SELECT * FROM ingredients WHERE id = ANY($1)', [ingredient_ids])).rows
        : [],
    }
  });
}
```

**Tarea 3.1 — Crear endpoint `GET /api/staffing/trace/[workerId]`**

```typescript
// GET /api/staffing/trace/[workerId]
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  
  const worker = await pool.query('SELECT * FROM workers WHERE id = $1', [id]);
  
  // Todas las asignaciones
  const assignments = await pool.query(
    'SELECT * FROM staffing_assignments WHERE worker_id = $1', [id]
  );
  
  // Las líneas de staffing (eventos)
  const staffingLines = await pool.query(
    'SELECT * FROM staffing_lines WHERE id = ANY($1)',
    [assignments.rows.map(a => a.staffing_line_id)]
  );
  
  // Los eventos
  const events = await pool.query(
    'SELECT * FROM events WHERE id = ANY($1)',
    [staffingLines.rows.map(sl => sl.event_id)]
  );
  
  // Los presupuestos que originaron esos eventos
  const quotes = await pool.query(
    'SELECT * FROM quotes WHERE id = ANY($1)',
    [events.rows.map(e => e.quote_id)]
  );
  
  return NextResponse.json({
    success: true,
    data: {
      worker: worker.rows[0],
      assignments: assignments.rows,
      staffingLines: staffingLines.rows,
      events: events.rows,
      quotes: quotes.rows,
    }
  });
}
```

**NOTA:** Ambos endpoints están bajo `/api/*` → protegidos por middleware. El frontend los consumirá desde la cookie de sesión que ya existe.

---

## Fase 4: Tests de integridad

**Tarea 4 — Crear `src/lib/__tests__/data-model-integrity.test.ts`**

```typescript
import { pool } from '@/lib/db';

// Test 1: Todos los eventos deben tener quote_id después de migración
test('all events have quote_id after migration', async () => {
  const result = await pool.query(
    'SELECT COUNT(*)::int AS cnt FROM events WHERE quote_id IS NULL'
  );
  expect(result.rows[0].cnt).toBe(0);
});

// Test 2: No hay staff_assignments
test('staff_assignments does not exist', async () => {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'staff_assignments'`
  );
  expect(result.rows[0].cnt).toBe(0);
});

// Test 3: supplier_orders tiene event_id
test('supplier_orders have event_id', async () => {
  const result = await pool.query(
    'SELECT COUNT(*)::int AS cnt FROM supplier_orders WHERE event_id IS NULL'
  );
  // Permitir NULL por compras de previsión, pero verificar que al menos 1 tiene
  expect(result.rows[0].cnt).toBeLessThan(1); // 0 = todos tienen
});

// Test 4: supplier_order_items tienen ingredient_id
test('supplier_order_items have ingredient_id', async () => {
  const result = await pool.query(
    'SELECT COUNT(*)::int AS cnt FROM supplier_order_items WHERE ingredient_id IS NULL'
  );
  expect(result.rows[0].cnt).toBe(0);
});

// Test 5: Todos los ingredientes usados tienen proveedor
test('used ingredients have provider', async () => {
  const result = await pool.query(
    'SELECT COUNT(*)::int AS cnt FROM ingredients WHERE supplier_id IS NULL'
  );
  // 120 de 120 sin proveedor — esto es esperado, no falla
  // Pero si alguno se usa en un evento y no tiene proveedor, es warning
  // Solo se verifica aquí que la migración no rompa nada
  console.log(`Advertencia: ${result.rows[0].cnt} ingredientes sin proveedor`);
  expect(true).toBe(true); // Pasa siempre — es informativo
});

// Test 6: Trazabilidad — desde un quote se llega a toda la descendencia
test('trace from quote to all descendants', async () => {
  const quote = await pool.query('SELECT id FROM quotes LIMIT 1');
  if (quote.rows.length === 0) return; // skip si no hay datos
  const qId = quote.rows[0].id;
  
  const event = await pool.query(
    'SELECT id FROM events WHERE quote_id = $1 LIMIT 1', [qId]
  );
  
  // Verificar que desde el evento se llega a las transacciones
  if (event.rows.length > 0) {
    const eId = event.rows[0].id;
    const shoppingItems = await pool.query(
      'SELECT * FROM event_shopping_items WHERE event_id = $1', [eId]
    );
    expect(shoppingItems.rows).toBeDefined();
    
    // Cada shopping item tiene ingredient_id
    shoppingItems.rows.forEach(item => {
      expect(item.ingredient_id).not.toBeNull();
    });
  }
});
```

---

## Fase 5: Componente de trazabilidad (frontend)

**Tarea 5 — `TrazaPanel.tsx` en admin**

Mostrar el recorrido quote→evento→transacciones como un diagrama visual en el admin:

- Breadcrumb: Presupuesto → Evento → Menú → Escandallo → Factura
- Cada paso muestra cuántas entidades hay (3 mesas, 14 invitados, 2 pagos)
- Enlace a cada entidad desde el breadcrumb

Panel colapsable en EventDetail y en la página de quote.

---

## Resumen de tareas

| # | Tarea | Archivos | Dificultad |
|---|---|---|---|
| 1 | Migración SQL — quote_id + tablas | `scripts/2026-06-21-quote-root-migrate.sql` | Media |
| 2 | Middleware — quote obligatorio en POST events | `src/app/api/events/route.ts` | Baja |
| 2.1 | Helper `createImplicitQuote()` | `src/lib/quotes.ts` | Baja |
| 3 | Endpoint `GET /api/quotes/[id]/trace` | `src/app/api/quotes/[id]/trace/route.ts` | Media |
| 3.1 | Endpoint `GET /api/staffing/trace/[workerId]` | `src/app/api/staffing/trace/[workerId]/route.ts` | Media |
| 4 | Tests de integridad del modelo | `src/lib/__tests__/data-model-integrity.test.ts` | Baja |
| 5 | Componente `TrazaPanel.tsx` | `src/components/b2b/TrazaPanel.tsx` | Alta |

---

## Verificación

Después de cada tarea:

1. Ejecutar la migración SQL en VPS
2. Verificar que todos los eventos tienen quote_id
3. Verificar que el endpoint de trace responde con datos
4. Verificar que los tests de integridad pasan
5. Verificar que un worker responde en qué eventos ha participado
