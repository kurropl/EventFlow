# Especificación: Motor de Cálculo de Costes Unificado + Ingrediente Único

**Versión:** 1.0.0
**Requisitos base:** La feature de saneamiento de unidades (`src/lib/units.ts`) debe estar deployada primero. Esta spec se construye sobre ella.

## Problema actual

### 1. Coste duplicado
- El coste de un **presupuesto** se calcula en el wizard (usando precios de catálogo)
- El coste de un **escandallo** se calcula en la vista `shopping_list` (sumando gramos × coste unitario)
- El coste de una **factura** se calcula en `BillingPanel` con `money()` inline
- Los tres pueden dar distintos porque cada uno tiene su propia lógica de redondeo y sus propios precios unitarios

### 2. Ingrediente no referenciado
- `event_shopping_items` tiene `ingredient_name` como text, no como FK a `ingredients(id)`
- El catálogo guarda `ingredients` como `jsonb[]` dentro de cada `catalog_item`, no como tabla independiente
- `selected_items` en un evento guarda `{name, quantity}` como texto, no como ID de catálogo
- No hay enlace entre el stock de un ingrediente, su coste y el coste de una receta

### 3. Datos vivos existentes
- 132 items en catálogo, 95 con ingredientes
- 5 eventos con items seleccionados
- ~35 registros en `event_shopping_items`
- Los nombres de los ingredientes en el escandallo son texto suelto (ej: `"Carrillera a baja temperatura con puré trufado"`) que NO coincide con el nombre en el catálogo (`"Carrillera a baja temperatura con puré de patatas trufado"`)

## Solución propuesta

### A. Motor de costes único (`src/lib/costing.ts`)
```typescript
// PUNTO ÚNICO de cálculo de costes para toda la aplicación
// Prohibido: recalc en componentes, en rutas, en vistas SQL

// Tipos
type CostRow = {
  ingredientId: string;        // FK única a ingredients(id)
  ingredientName: string;      // display name (no calculable)
  baseUnit: string;            // g | ml | ud (nunca kg o L — ya normalizado)
  quantityInBase: number;      // cantidad en unidad base
  unitCost: number;            // coste por unidad base (€ / g, € / ml, € / ud)
};

// Cálculos (todos al mismo tiempo, en la misma función)
type CostResult = {
  lineCosts: CostRow[];        // cada línea con su coste individual
  subtotal: number;            // suma de lineCosts (sin impuestos)
  margin: number;               // margen en €
  marginPercent: number;       // margen en %
  pvp: number;                 // precio de venta al público
  scaledByGuests: number;      // el mismo resultado escalado a N comensales
};

function computeEventCost(
  selectedItems: SelectedItem[],       // del evento completo
  catalogIngredients: Ingredient[]       // del catálogo (precios actualizados)
): CostResult;

function costRowFromOrder(
  orderItem: {                         // cada línea del event_shopping_items
    ingredientId: string;
    quantity: number;                  // cantidad en uds
    unit: string;                      // unidad
    unitCost: number;                  // coste por unidad
  },
  guests: number                      // escalado
): CostRow;
```

### B. Ingrediente único en DB (`ingredients` como tabla, no como JSONB embebido)

```sql
-- 1. Crear tabla ingredients (independiente de catalog_items)
CREATE TABLE IF NOT EXISTS ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'general',
  unit TEXT NOT NULL DEFAULT 'g',      -- unidad de compra/venta
  unit_cost NUMERIC(10,4) NOT NULL DEFAULT 0,  -- € por unidad base
  pvp_ratio NUMERIC(5,4) NOT NULL DEFAULT 1,  -- markup sobre coste
  stock_unit TEXT NOT NULL DEFAULT 'g',       -- en qué unidad se almacena
  packaging_size NUMERIC(10,2),              -- tamaño de envase
  supplier_id UUID REFERENCES suppliers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### C. Migración de datos (script único, no a mano)

```sql
-- Paso 1: Extraer nombres únicos de ingredientes del catálogo
INSERT INTO ingredients (name, unit, unit_cost, pvp_ratio)
SELECT DISTINCT 
  jsonb_array_elements_text(ci.ingredients->>'name') AS name,
  'g' AS unit,   -- valor por defecto
  0 AS unit_cost, -- se actualizará después
  1 AS pvp_ratio
FROM catalog_items ci
WHERE jsonb_typeof(ci.ingredients) = 'array' AND jsonb_array_length(ci.ingredients) > 0
ON CONFLICT (name) DO NOTHING;

-- Paso 2: Migrar event_shopping_items a usar ingredient_id
ALTER TABLE event_shopping_items ADD COLUMN IF NOT EXISTS ingredient_id UUID REFERENCES ingredients(id);
UPDATE event_shopping_items esi SET ingredient_id = i.id
FROM ingredients i WHERE i.name = esi.ingredient_name;

-- Paso 3: Normalizar nombres sueltos (ej: 'Carrillera...' → 'Carrillera...')
-- Se hace vía función de matching LIKE que busca el más cercano
```

### D. Test de regresión de costes (obligatorio antes del deploy)

```typescript
// src/lib/__tests__/costing.test.ts
describe('computeEventCost', () => {
  it('mismo coste en presupuesto, escandallo y factura', () => {
    const event = { selectedItems: [...], guests: 50 };
    const budget = computeEventCost(event, catalog); // desde presupuesto
    const shop = computeEventCost(event, catalog);    // desde escandallo
    const invoice = computeEventCost(event, catalog); // desde factura
    expect(budget.total).toBe(shop.total);             // igual
    expect(shop.total).toBe(invoice.total);            // igual
  });

  it('modificar coste de ingrediente propaga a recetas', () => {
    const oldCost = computeLineCost(ingredientId, 1000, 'g');
    setUnitCost(ingredientId, 0.05);  // sube de 0.02 a 0.05
    const newCost = computeLineCost(ingredientId, 1000, 'g');
    expect(newCost).toBe(50);           // 1000 * 0.05 = 50
  });

  it('escalado por comensales (50 → 100)', () => {
    const fifty = computeEventCost(event, catalog, 50);
    const hundred = computeEventCost(event, catalog, 100);
    expect(hundred.total).toBeCloseTo(fifty.total * 2, 2);
  });

  it('margen en % correcto', () => {
    const result = computeEventCost(event, catalog);
    expect(result.marginPercent).toBeGreaterThanOrEqual(20); // mínimo 20%
  });
});
```

## Archivos
| Archivo | Acción |
|---|---|
| `src/lib/costing.ts` | **CREAR** — motor único de coste |
| `src/lib/__tests__/costing.test.ts` | **CREAR** — tests de regresión |
| `src/components/b2b/BudgetEditor.tsx` | **MODIFICAR** — usar `computeEventCost()` |
| `src/components/b2b/OperationsManager.tsx` | **MODIFICAR** — usar `costRowFromOrder()` |
| `src/components/b2b/BillingPanel.tsx` | **MODIFICAR** — usar `computeEventCost()` |
| `schema.sql` (sección escandallo) | **MODIFICAR** — `ingredient_id` FK + `catalog_id` |
| `scripts/2025-06-20-migrate-ingredients.sql` | **CREAR** — migración única |

## No incluye
- Interfaz de gestión de stock (se hace en otro módulo)
- Catálogo de proveedores (ya existe como `suppliers`)
- Cálculo de impuestos (IVA se añade después como capa)