# Plan de Implementación: Módulo Cocina — Hojas Operativas y Gestión de Escandallos

> **Para Hermes:** Implementar usando subagent-driven-development, tarea por tarea, con revisión en dos etapas.
>
> **Stack:** Next.js 14.2 + PostgreSQL + TypeScript + Zod + Vitest  
> **Depende de:** Escandallo como Fuente de Verdad ya implementado (migraciones V1 + V2 ejecutadas)
>
> **Arquitectura:** El módulo Cocina es una sección más del admin (`/admin/cocina/*`). Sigue el mismo patrón que `leads`, `stock`, `staffing`: un panel dinámico (`CocinaPanel`) que se carga cuando `pathname.includes('cocina')`. Las 3 hojas (producción, carga, logística) son sub-tabs dentro del panel.
>
> **Routing:** `src/app/api/cocina/*` para API + `src/app/admin/cocina/*` para el frontend del panel. No hace falta middleware nuevo — el `/api/cocina/*` ya está protegido por el middleware global.

---

## Fase 0: Setup del módulo Cocina en admin

### Task 0.1: Crear `CocinaPanel` en admin (panel de cocina)

**Archivos:**
- Create: `src/app/admin/cocina/page.tsx` (panel principal, re-export de `page.tsx` con Suspense)
- Create: `src/components/b2b/CocinaPanel.tsx` (panel contenedor con sub-tabs: Recetas, Hojas, Escandallos, Equipamiento)
- Modify: `src/app/admin/page.tsx` (añadir `isCocina` al pathname detection y renderizar `CocinaPanel`)

**Patrón a seguir:**
```tsx
// src/app/admin/cocina/page.tsx — sub-pages re-export
import { Suspense } from 'react';
import CocinaPanel from '@/components/b2b/CocinaPanel';
import { PanelSkeleton } from '@/app/admin/page';

export default function CocinaPage() {
  return <Suspense fallback={<PanelSkeleton />}><CocinaPanel /></Suspense>;
}
```

### Task 0.2: Navegación — añadir ítem Cocina al menú lateral

Ya hay un `NavigationItems` configurable. Verificar en `AdminLayout` si el menú es dinámico y añadir `{ label: 'Cocina', href: '/admin/cocina' }` con icono de cuchillo.

---

## Fase 1: Modelo de datos — tablas de servicio

### Task 1.1: `service_passes` (pases de servicio por defecto)

**Archivo:** `scripts/2026-06-22-cocina-service-passes.sql`

```sql
CREATE TABLE IF NOT EXISTS service_passes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pass_number INT NOT NULL,
    name TEXT NOT NULL,
    icon VARCHAR(10) DEFAULT '🍽️',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Pases por defecto
INSERT INTO service_passes (pass_number, name, icon, sort_order) VALUES
    (1, 'Aperitivos y entrantes', '🥟', 1),
    (2, 'Mesas y compartidos', '🥘', 2),
    (3, 'Principal', '🥩', 3),
    (4, 'Dulce y final', '🍰', 4),
    (5, 'Bebidas', '🥂', 5),
    (99, 'Complementos', '🧂', 99);
```

### Task 1.2: `category_pass_mapping` (mapeo categoría → pase)

```sql
CREATE TABLE IF NOT EXISTS category_pass_mapping (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category TEXT NOT NULL UNIQUE,
    pass_id UUID NOT NULL REFERENCES service_passes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO category_pass_mapping (category, pass_id) VALUES
    ('aperitivo-frio',    (SELECT id FROM service_passes WHERE pass_number = 1)),
    ('aperitivo-caliente', (SELECT id FROM service_passes WHERE pass_number = 1)),
    ('compartir-mesa',    (SELECT id FROM service_passes WHERE pass_number = 2)),
    ('arroz',             (SELECT id FROM service_passes WHERE pass_number = 3)),
    ('carne',             (SELECT id FROM service_passes WHERE pass_number = 3)),
    ('pescado',           (SELECT id FROM service_passes WHERE pass_number = 3)),
    ('sorbete',           (SELECT id FROM service_passes WHERE pass_number = 4)),
    ('postre',            (SELECT id FROM service_passes WHERE pass_number = 4)),
    ('bebida',            (SELECT id FROM service_passes WHERE pass_number = 5)),
    ('complemento',       (SELECT id FROM service_passes WHERE pass_number = 99));
```

### Task 1.3: Añadir `custom_pass_order` a events

```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_pass_order JSONB DEFAULT '[]';
-- Formato: [{"item_id": "uuid-del-catalog", "pass_number": 3}]
```

### Task 1.4: `equipment` (catálogo de equipamiento con stock)

```sql
CREATE TABLE IF NOT EXISTS equipment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('utensilio', 'vajilla', 'maquinaria', 'textil', 'mobiliario', 'descartable')),
    unit TEXT NOT NULL DEFAULT 'ud',
    stock_quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
    min_stock NUMERIC(10,2) DEFAULT 0,
    notes TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_equipment_category ON equipment(category);
```

### Task 1.5: `equipment_rules` (reglas: qué equipo necesita cada plato)

```sql
CREATE TABLE IF NOT EXISTS equipment_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category TEXT,
    catalog_item_id UUID REFERENCES catalog_items(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    quantity_per_use NUMERIC(10,2) NOT NULL DEFAULT 1,
    per_guest BOOLEAN DEFAULT false,
    notes TEXT
);
```

### Task 1.6: `recipes` (recetas subidas)

```sql
CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'excel', 'pdf', 'scanned')),
    source_file TEXT,
    servings INT DEFAULT 1,
    category TEXT,
    ingredients JSONB DEFAULT '[]',
    instructions TEXT,
    prep_time INT,
    cook_time INT,
    difficulty TEXT DEFAULT 'media',
    version INT NOT NULL DEFAULT 1,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_recipes_name ON recipes(name);
```

### Task 1.7: `event_production_sheets` (cache de hojas generadas)

```sql
CREATE TABLE IF NOT EXISTS event_production_sheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    sheet_type TEXT NOT NULL CHECK (sheet_type IN ('production', 'loading', 'logistics')),
    content JSONB NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT now(),
    regenerated_at TIMESTAMPTZ,
    UNIQUE(event_id, sheet_type)
);
```

---

## Fase 2: Motor de generación de hojas

### Task 2.1: `src/lib/cocinaSheets.ts` — Generador de hojas

**Archivo:** `src/lib/cocinaSheets.ts`

```typescript
import { getPool } from '@/lib/db';

interface PassItem {
  passNumber: number;
  passName: string;
  items: {
    catalogName: string;
    category: string;
    quantity: number;        // unidades totales (racion * guest_count)
    ingredientId: string;
    ingredientName: string;
    ingredientQty: number;
  }[];
}

/**
 * Genera hoja de producción: agrupa por pase
 * - Escala cantidades por guest_count y por pase
 * - Devuelve JSON con estructura para render
 */
export async function generateProductionSheet(
  eventId: string
): Promise<{ passes: PassItem[]; totals: Record<string, number> }> {
  const pool = getPool();
  const event = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);

  const passItems = await pool.query(
    `SELECT 
       esi.id AS item_id,
       ci.name AS catalog_name,
       esi.category,
       esi.estimated_cost,
       esi.recipe_item_id,
       ri.quantity AS recipe_qty,
       COALESCE(cpm.pass_number, 
         CASE 
           WHEN esi.category IN ('aperitivo-frio','aperitivo-caliente') THEN 1
           WHEN esi.category = 'compartir-mesa' THEN 2
           WHEN esi.category IN ('arroz','carne','pescado') THEN 3
           WHEN esi.category IN ('sorbete','postre') THEN 4
           WHEN esi.category = 'bebida' THEN 5
           ELSE 99
         END
       ) AS pass_number
     FROM event_shopping_items esi
     LEFT JOIN category_pass_mapping cpm ON cpm.category = esi.category
     LEFT JOIN recipe_items ri ON ri.id = esi.recipe_item_id
     LEFT JOIN catalog_items ci ON ci.id = esi.catalog_item_id  -- ???
     WHERE esi.event_id = $1 AND esi.frozen = false
     ORDER BY pass_number`,
    [eventId]
  );

  // Agrupar por pase
  // ...
}

/**
 * Genera hoja de carga: perecedero/no perecedero, por pase
 */
export async function generateLoadingSheet(
  eventId: string
): Promise<{ perecedero: PassItem[]; noPerecedero: PassItem[] }> {
  // De la misma query pero separando por categoria de ingrediente
  // perecedero: carnes, pescados, verduras, lácteos
  // no perecedero: harina, arroz, especias, conservas
}

/**
 * Genera hoja logística: equipamiento, seco, perecedero, descartables
 */
export async function generateLogisticsSheet(
  eventId: string
): Promise<{ 
  equipment: { name: string; qty: number; available: number }[];
  dryGoods: { name: string; qty: number; unit: string }[];
  perishable: { name: string; qty: number; unit: string }[];
  disposables: { name: string; qty: number; unit: string }[];
}> {
  // Obtener equipment_rules para los platos del evento
  // Calcular si hay stock suficiente
  // Alertar si algún equipo necesario está en 0
}
```

### Task 2.2: API para las hojas

```
GET /api/cocina/event/[eventId]/production → Devuelve JSON de producción
GET /api/cocina/event/[eventId]/loading → Devuelve JSON de carga
GET /api/cocina/event/[eventId]/logistics → Devuelve JSON de logística
```

### Task 2.3: Asignación de pase por evento

```
GET /api/cocina/event/[eventId]/passes → Lista pases con platos asignados
PUT /api/cocina/event/[eventId]/passes → Reasigna platos a pases manualmente
```

---

## Fase 3: Gestión de recetas

### Task 3.1: CRUD de recetas

```
GET /api/cocina/recipes — Lista (con filtro por categoría, paginado)
POST /api/cocina/recipes — Crear desde formulario
```

### Task 3.2: Importar Excel

```
POST /api/cocina/recipes/import — Sube XLSX, parsea, crea recipe(s)
```

El parseo: usar `xlsx` (npm package) para leer columnas `Nombre | Ingrediente | Cantidad | Unidad | Tiempo`.

### Task 3.3: Receta → Escandallo

```
POST /api/cocina/recipes/[id]/to-escandallo
```

Toma una receta y crea `recipe_items` para el `catalog_item` indicado en el body.

---

## Fase 4: Equipamiento

### Task 4.1: CRUD equipamiento

```
GET /api/cocina/equipment — Lista
POST /api/cocina/equipment — Crear
PUT /api/cocina/equipment/[id] — Actualizar stock
```

### Task 4.2: Reglas de equipamiento por plato

```
GET /api/cocina/equipment-rules — Lista reglas
POST /api/cocina/equipment-rules — Crear regla
```

---

## Fase 5: Frontend — CocinaPanel

### Task 5.1: Panel de recetas

Tres columnas: lista de recetas, formulario de creación, importación Excel.

### Task 5.2: Panel de hojas operativas

Tres sub-tabs:
- **Producción**: tabla con columnas Ingrediente | Cantidad total | Plato(s) | Pase
- **Carga**: tabla con columnas Producto | Cantidad | Perecedero/No | Pase
- **Logística**: tabla con columnas Equipo | Stock disponible (rojo si < needed)

### Task 5.3: Panel de escandallos por evento

Tabla con teórico vs real, input para registrar consumo real.

---

## Ruta de ejecución

1. Migraciones SQL (V1-V7)
2. `cocinaSheets.ts`
3. API endpoints
4. CocinaPanel en frontend
5. Tests + build + deploy