# Plan de Implementación: Escandallo como Fuente de Verdad — Versionado, Teórico vs Real

> **Para Hermes:** Usar subagent-driven-development para implementar tarea por tarea con revisión en dos etapas (spec compliance → code quality).
>
> **Objetivo:** Convertir el escandallo en la fuente de verdad de la cocina con versionado de recetas, distinción teórico/real y escalado automático por comensales.
>
> **Arquitectura:** `recipe_items` es la plantilla (catalog_item → ingredient + quantity por ración). `event_shopping_items` se instancia desde ella escalando por `guest_count`. Cada cambio de precio se propaga con alerta de margen. Al cerrar evento se congela y se calcula desviación.
>
> **Tech Stack:** Next.js 14 + PostgreSQL + TypeScript + Zod + Vitest

**Depende de:** `costing.ts` (motor de costes unificado), `ingredient_price_history` (existente, vacía), `data-model-connectivity` (quote_id como raíz)

---

## Fase 0: Verificar estado actual

### Task 0.1: Confirmar tablas existentes

**Verificar que `recipe_items` e `ingredient_price_history` existen (vacías):**

```bash
ssh root@vps "docker exec -i postgres psql -U eventflow -c '\\d recipe_items'"
ssh root@vps "docker exec -i postgres psql -U eventflow -c '\\d ingredient_price_history'"
```

**Confirmar que `event_shopping_items` tiene `actual_quantity`, `actual_unit`, `actual_cost`:**

```bash
ssh root@vps "docker exec -i postgres psql -U eventflow -c '\\d event_shopping_items'"
```

### Task 0.2: Verificar `recipe_items` actual (quitarle version y unit_dimension si no tiene)

---

## Fase 1: Migración SQL — tablas nuevas y columnas

### Task 1: Añadir columnas a `recipe_items`

**Objetivo:** Añadir version, unit_dimension y unit a recipe_items para que cada ración tenga cantidad por comensal.

**Archivo:** `scripts/2026-06-22-escandallo-migrate-v1.sql`

```bash
ssh root@vps "docker exec -i postgres psql -U eventflow -f /dev/stdin << 'SQL'
ALTER TABLE recipe_items ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;
ALTER TABLE recipe_items ADD COLUMN IF NOT EXISTS version_note TEXT;
ALTER TABLE recipe_items ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT 'g';
ALTER TABLE recipe_items ADD COLUMN IF NOT EXISTS unit_dimension TEXT
  CHECK (unit_dimension IN ('mass','volume','count'));
-- unit_dimension ya existe como check en event_shopping_items
-- aquí lo unificamos con la receta
ALTER TABLE recipe_items ADD COLUMN IF NOT EXISTS quantity_override NUMERIC(10,2)
  DEFAULT NULL; -- permite override manual sin mutar la plantilla
SQL
```

### Task 2: Añadir columnas a `event_shopping_items` (teórico vs real + versión)

**Archivo:** `scripts/2026-06-22-escandallo-migrate-v2.sql`

```sql
ALTER TABLE event_shopping_items
  ADD COLUMN IF NOT EXISTS recipe_item_id UUID REFERENCES recipe_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recipe_version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS theoretical_qty NUMERIC(10,2), -- cantidad escalada por guest_count
  ADD COLUMN IF NOT EXISTS theoretical_unit VARCHAR(20),
  ADD COLUMN IF NOT EXISTS theoretical_unit_dimension TEXT,
  ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(10,2), -- theoretical_qty * cost_per_unit
  ADD COLUMN IF NOT EXISTS actual_cost_total NUMERIC(10,2), -- actual_quantity * unit_cost (real)
  ADD COLUMN IF NOT EXISTS deviation_qty NUMERIC(10,2), -- actual - theoretical
  ADD COLUMN IF NOT EXISTS deviation_cost NUMERIC(10,2), -- actual_cost - estimated_cost
  ADD COLUMN IF NOT EXISTS frozen BOOLEAN NOT NULL DEFAULT false;
```

### Task 3: Crear `event_cost_deviations` (desviación final del evento)

```sql
CREATE TABLE IF NOT EXISTS event_cost_deviations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  estimated_total_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  actual_total_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  deviation_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  deviation_pct NUMERIC(5,2),
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);
```

### Task 4: Crear `recipe_item_versions` (histórico de versiones de receta)

```sql
CREATE TABLE IF NOT EXISTS recipe_item_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_item_id UUID NOT NULL REFERENCES recipe_items(id) ON DELETE CASCADE,
  version INT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  unit VARCHAR(20),
  unit_dimension TEXT,
  changed_by TEXT DEFAULT 'system',
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);
```

---

## Fase 2: Triggers de propagación

### Task 5: Trigger de historial de precios en `ingredients`

**Archivo:** `scripts/2026-06-22-trigger-price-history.sql`

```sql
CREATE OR REPLACE FUNCTION record_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.unit_cost IS DISTINCT FROM NEW.unit_cost THEN
    INSERT INTO ingredient_price_history (ingredient_id, old_price, new_price, changed_by)
    VALUES (NEW.id, OLD.unit_cost, NEW.unit_cost, 'system');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_record_price
  AFTER UPDATE OF unit_cost ON ingredients
  FOR EACH ROW EXECUTE FUNCTION record_price_change();
```

### Task 6: Trigger de recálculo de escandallo al cambiar `guest_count`

Cuando un evento cambia `guest_count`, se recalculan todas las `theoretical_qty`:

```sql
CREATE OR REPLACE FUNCTION recalc_event_escandallo()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.guest_count IS DISTINCT FROM NEW.guest_count THEN
    -- Marcar los items del escandallo para recalcular
    -- El backend hará la actualización real (las queries son pesadas)
    UPDATE events SET needs_recalc = true WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recalc_escandallo
  AFTER UPDATE OF guest_count ON events
  FOR EACH ROW EXECUTE FUNCTION recalc_event_escandallo();
```

### Task 7: Trigger de congelación al cerrar evento

```sql
CREATE OR REPLACE FUNCTION freeze_escandallo_on_close()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'completado' AND NEW.status = 'completado' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- NO Kamp — si se actualiza y no cambia, no es cierre
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Disparador: cuando status pasa a 'completado'
CREATE TRIGGER trg_freeze_on_complete
  AFTER UPDATE OF status ON events
  FOR EACH ROW
  WHEN (NEW.status = 'completado' AND OLD.status != 'completado')
  EXECUTE FUNCTION freeze_escandallo_on_close();
```

---

## Fase 3: Motor de recálculo centralizado

### Task 8: `src/lib/recalcEscandallo.ts` — Función de recálculo

**Crear:**

```typescript
/**
 * Recalcula el escandallo de un evento:
 * - Escala recipe_items por guest_count
 * - Actualiza theoretical_qty en event_shopping_items
 * - Actualiza event_costs
 * - Si frozen, no toca
 */

import { getPool } from '@/lib/db';

export async function recalcEventEscandallo(eventId: string): Promise<void> {
  const pool = getPool();

  // 1. Obtener el evento
  const event = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);
  if (!event.rows.length) return;
  const ev = event.rows[0];
  const guestCount = Number(ev.guest_count) || 1;

  // 2. Obtener los items del escandallo con recipe_item_id
  const items = await pool.query(
    `SELECT esi.id, esi.recipe_item_id, esi.frozen, ri.quantity AS recipe_qty, ri.unit, ri.unit_dimension
     FROM event_shopping_items esi
     LEFT JOIN recipe_items ri ON ri.id = esi.recipe_item_id
     WHERE esi.event_id = $1 AND esi.frozen = false`,
    [eventId]
  );

  // 3. Para cada item no congelado, recalcular
  for (const item of items.rows) {
    if (item.frozen) continue;
    const recipeQty = Number(item.recipe_qty) || 0;
    const newTheoreticalQty = recipeQty * guestCount;

    await pool.query(
      `UPDATE event_shopping_items
       SET theoretical_qty = $1,
           estimated_cost = $2 * (SELECT cost_per_unit FROM ingredients WHERE id = (SELECT ingredient_id FROM event_shopping_items WHERE id = $3))
       WHERE id = $4`,
      [newTheoreticalQty, newTheoreticalQty, item.id, item.id]
    );
  }

  // 4. Recalcular event_costs
  await pool.query(
    `DELETE FROM event_costs WHERE event_id = $1`,
    [eventId]
  );

  const result = await pool.query(
    `INSERT INTO event_costs (event_id, ingredient_id, ingredient_name, quantity, unit, unit_cost, line_total)
     SELECT $1, i.id, i.name, esi.theoretical_qty, esi.theoretical_unit, i.unit_cost, esi.theoretical_qty * i.unit_cost
     FROM event_shopping_items esi
     JOIN ingredients i ON i.id = esi.ingredient_id
     WHERE esi.event_id = $1 AND esi.frozen = false`,
    [eventId]
  );
}
```

### Task 9: `src/lib/alertMargin.ts` — Alerta de margen

```typescript
/**
 * Verifica si un plato cae por debajo del margen mínimo
 * y genera alerta si es necesario
 */

export async function checkMarginAlerts(eventId: string): Promise<void> {
  const pool = getPool();

  // Obtener items del escandallo con su PVP del catálogo
  const items = await pool.query(
    `SELECT esi.id, ci.pvp, esi.estimated_cost,
            (ci.pvp - esi.estimated_cost) / NULLIF(ci.pvp, 0) * 100 AS margin_pct
     FROM event_shopping_items esi
     JOIN recipe_items ri ON ri.id = esi.recipe_item_id
     JOIN catalog_items ci ON ci.id = ri.catalog_item_id
     WHERE esi.event_id = $1 AND esi.frozen = false`,
    [eventId]
  );

  for (const row of items.rows) {
    const margin = Number(row.margin_pct);
    if (margin < 15) { // 15% margen mínimo
      console.warn(
        `⚠️ Alerta de margen: el plato ha caído por debajo del 15% (margen actual: ${margin.toFixed(1)}%)`
      );
      // En producción: emitir webhook, guardar en tabla de alertas
    }
  }
}
```

---

## Fase 4: API Endpoints

### Task 10: `GET /api/escandallo/event/[eventId]` — Escandallo del evento

```typescript
export async function GET(
  _request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  const eventId = params.eventId;

  // Teórico
  const theoretical = await pool.query(
    `SELECT esi.id, esi.ingredient_id, esi.ingredient_name,
            esi.theoretical_qty, esi.theoretical_unit,
            esi.estimated_cost, i.unit_cost AS current_unit_cost
     FROM event_shopping_items esi
     JOIN ingredients i ON i.id = esi.ingredient_id
     WHERE esi.event_id = $1 AND esi.frozen = false`,
    [eventId]
  );

  // Real
  const actual = await pool.query(
    `SELECT esi.id, esi.actual_quantity, esi.actual_unit,
            esi.actual_cost_new, esi.actual_cost_total
     FROM event_shopping_items esi
     WHERE esi.event_id = $1 AND esi.frozen = false AND esi.actual_quantity IS NOT NULL`,
    [eventId]
  );

  // Desviación
  const deviation = await pool.query(
    `SELECT esi.id, esi.deviation_qty, esi.deviation_cost
     FROM event_shopping_items esi
     WHERE esi.event_id = $1 AND esi.frozen = true`,
    [eventId]
  );

  return NextResponse.json({
    theoretical: theoretical.rows,
    actual: actual.rows,
    deviation: deviation.rows,
  });
}
```

### Task 11: `POST /api/escandallo/event/[eventId]/freeze` — Congelar

```typescript
export async function POST(
  _request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  const eventId = params.eventId;

  // 1. Congelar escandallo
  await pool.query(
    `UPDATE event_shopping_items SET frozen = true WHERE event_id = $1`,
    [eventId]
  );

  // 2. Calcular desviación total
  const estimatedTotal = await pool.query(
    `SELECT SUM(estimated_cost) FROM event_shopping_items WHERE event_id = $1`,
    [eventId]
  );
  const actualTotal = await pool.query(
    `SELECT SUM(actual_cost_new) FROM event_shopping_items WHERE event_id = $1`,
    [eventId]
  );

  const estimated = Number(estimatedTotal.rows[0].sum) || 0;
  const actual = Number(actualTotal.rows[0].sum) || 0;
  const deviation = actual - estimated;
  const pct = estimated > 0 ? (deviation / estimated) * 100 : 0;

  // 3. Guardar desviación final
  await pool.query(
    `INSERT INTO event_cost_deviations (event_id, estimated_total_cost, actual_total_cost, deviation_amount, deviation_pct)
     VALUES ($1, $2, $3, $4, $5)`,
    [eventId, estimated, actual, deviation, pct]
  );

  return NextResponse.json({
    success: true,
    deviation: { estimated, actual, deviation, pct: Math.round(pct * 100) / 100 },
  });
}
```

### Task 12: `PUT /api/escandallo/event/[eventId]` — Registrar consumo real

```typescript
export async function PUT(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  const body = await request.json();
  const { itemId, actualQty, actualUnit, actualCost } = body;

  await pool.query(
    `UPDATE event_shopping_items
     SET actual_quantity = $1,
         actual_unit = $2,
         actual_cost_total = $3,
         actual_cost_new = $3
     WHERE id = $4 AND event_id = $5`,
    [actualQty, actualUnit, actualCost, itemId, params.eventId]
  );

  // Recalcular desviación
  await pool.query(
    `UPDATE event_shopping_items
     SET deviation_qty = actual_quantity - theoretical_qty,
         deviation_cost = actual_cost_total - estimated_cost
     WHERE id = $1`,
    [itemId]
  );

  return NextResponse.json({ success: true });
}
```

---

## Fase 5: Tool de recálculo masivo

### Task 13: `PUT /api/escandallo/ingredient-prices` — Propagación masiva

```typescript
/**
 * Cuando cambia el precio de un ingrediente, se propaga
 * a todos los eventos no congelados que lo usan
 */

export async function PUT(
  request: NextRequest,
) {
  const body = await request.json();
  const { ingredientId, newPrice } = body;

  // Registrar en historial
  const oldPrice = await pool.query(
    'SELECT unit_cost FROM ingredients WHERE id = $1',
    [ingredientId]
  );
  const old = Number(oldPrice.rows[0]?.unit_cost) || 0;

  await pool.query(
    `INSERT INTO ingredient_price_history (ingredient_id, old_price, new_price)
     VALUES ($1, $2, $3)`,
    [ingredientId, old, newPrice]
  );

  // Actualizar precio
  await pool.query(
    `UPDATE ingredients SET unit_cost = $1 WHERE id = $2`,
    [newPrice, ingredientId]
  );

  // Propagar a todos los escandallos no congelados
  const affected = await pool.query(
    `SELECT event_id FROM event_shopping_items
     WHERE ingredient_id = $1 AND frozen = false`,
    [ingredientId]
  );

  for (const row of affected.rows) {
    await recalcEventEscandallo(row.event_id);
    await checkMarginAlerts(row.event_id);
  }

  return NextResponse.json({
    success: true,
    affected: affected.rows.length,
  });
}
```

---

## Task list completa

| # | Tarea | Archivos | ¿Qué hace? |
|---|---|---|---|
| 1 | Columnas recipe_items | SQL migración | Añade version, quantity_override |
| 2 | Columnas event_shopping_items | SQL | Añade theoretical_qty, frozen, deviation |
| 3 | event_cost_deviations | SQL | Crea tabla de desviación final |
| 4 | recipe_item_versions | SQL | Crea tabla de versiones históricas |
| 5 | Trigger price history | SQL | Cada cambio de precio se registra |
| 6 | Trigger guest_count | SQL | Recálculo automático al cambiar comensales |
| 7 | Trigger freeze | SQL | Al cerrar evento, congelación automática |
| 8 | recalcEscandallo.ts | TS | Motor de recálculo (lib) |
| 9 | alertMargin.ts | TS | Alerta de margen mínimo (lib) |
| 10 | API escandallo event | TS | GET con teórico/real/desviación |
| 11 | API freeze | TS | POST para congelar escandallo |
| 12 | API registrar consumo | PUT | Registrar actual_quantity manual |
| 13 | API propagación precios | PUT | Propagar cambio de precio masivo |

---

## Ejecución

```bash
# 1. Migraciones SQL en orden
ssh root@vps "psql -f scripts/2026-06-22-escandallo-migrate-v1.sql"
ssh root@vps "psql -f scripts/2026-06-22-escandallo-migrate-v2.sql"

# 2. Triggers
ssh root@vps "psql -f scripts/2026-06-22-trigger-price-history.sql"

# 3. Tests
npm test

# 4. Build
npm run build

# 5. Deploy
git push && docker compose up -d
```