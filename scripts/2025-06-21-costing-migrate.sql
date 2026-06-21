-- ============================================================
-- EventFlow — Migración del motor de costes unificado
-- + Ingrediente único + tabla costing
-- ============================================================
-- Ejecutar: psql "$DATABASE_URL" -f scripts/2025-06-21-costing-migrate.sql

-- ============================================================
-- 1. Tabla de ingredientes (independiente de catalog_items)
-- ============================================================
CREATE TABLE IF NOT EXISTS ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL DEFAULT 'general',
    -- Unit = unidad base (g, ml, ud). Nunca 'kg' ni 'L' ni 'doc'
    unit TEXT NOT NULL DEFAULT 'g',
    -- Coste por unidad base (€/g, €/ml, €/ud) con 4 decimales
    unit_cost NUMERIC(8,4) NOT NULL DEFAULT 0,
    -- Margen PVP sobre coste (1.0 = sin margen, 1.20 = 20%, etc.)
    pvp_ratio NUMERIC(5,4) NOT NULL DEFAULT 1.0,
    -- Unidad de stock (en qué unidad se almacena)
    stock_unit TEXT NOT NULL DEFAULT 'g',
    -- Tamaño de envase (ej: 1 kg = 1000 g)
    packaging_size NUMERIC(10,2),
    -- Proveedor (opcional)
    supplier_id UUID REFERENCES suppliers(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ingredients_name ON ingredients(name);
ALTER TABLE ingredients DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Migrar datos desde catalog_items a ingredients
-- ============================================================
-- Extraer nombres únicos de los ingredientes existentes en catálogo
INSERT INTO ingredients (name, unit, unit_cost, pvp_ratio)
SELECT DISTINCT
    jsonb_array_elements(ci.ingredients)->>'name' AS name,
    'g' AS unit,
    0 AS unit_cost,
    1.0 AS pvp_ratio
FROM catalog_items ci
WHERE ci.ingredients IS NOT NULL AND jsonb_typeof(ci.ingredients) = 'array'
    AND jsonb_array_length(ci.ingredients) > 0
ON CONFLICT (name) DO NOTHING;

-- Items de menú sin catálogo (texto suelto)
INSERT INTO ingredients (name, unit, unit_cost, pvp_ratio)
SELECT DISTINCT
    jsonb_array_elements(e.selected_items)->>'name' AS name,
    'g' AS unit,
    0 AS unit_cost,
    1.0 AS pvp_ratio
FROM events e
WHERE e.selected_items IS NOT NULL AND jsonb_typeof(e.selected_items) = 'array'
    AND jsonb_array_length(e.selected_items) > 0
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 3. Tabla de costes por evento
-- ============================================================
CREATE TABLE IF NOT EXISTS event_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    order_id UUID REFERENCES event_orders(id) ON DELETE SET NULL,
    -- Cada línea de coste
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    ingredient_name TEXT NOT NULL,
    -- Cantidad en unidad base (g, ml, ud)
    quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'g',
    -- Coste por unidad base (€/g, €/ml, €/ud)
    unit_cost NUMERIC(8,4) NOT NULL DEFAULT 0,
    -- Coste total de esta línea
    line_total NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_costs_event ON event_costs(event_id);
ALTER TABLE event_costs DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. Migrar event_shopping_items a ingredient_id
-- ============================================================
ALTER TABLE event_shopping_items ADD COLUMN IF NOT EXISTS ingredient_id UUID REFERENCES ingredients(id);

-- Asignar ingredient_id por nombre (busca match exacto o LIKE)
UPDATE event_shopping_items esi
SET ingredient_id = i.id
FROM ingredients i
WHERE i.name = esi.ingredient_name;

-- Los que no tienen match → marcar con note 'pendiente de asignar'
UPDATE event_shopping_items
SET ingredient_id = NULL
WHERE ingredient_id IS NULL AND ingredient_name IS NOT NULL;

-- ============================================================
-- 5. Vista de coste unificada (para que todas las pantallas vean lo mismo)
-- ============================================================
DROP VIEW IF EXISTS v_event_cost;
CREATE VIEW v_event_cost AS
SELECT
    eo.id AS event_id,
    eo.client_name,
    ec.ingredient_id,
    ec.ingredient_name,
    ec.quantity,
    ec.unit,
    ec.unit_cost,
    ec.line_total,
    -- Total general
    SUM(ec.line_total) OVER (PARTITION BY eo.id) AS total_cost
FROM event_orders eo
JOIN events e ON e.id = eo.event_id
LEFT JOIN event_costs ec ON ec.event_id = e.id
WHERE eo.status IN ('draft', 'sent', 'accepted');

-- ============================================================
-- 6. Verificación
-- ============================================================
SELECT 'Migración OK' AS status;
SELECT COUNT(*) AS ingredients FROM ingredients;
SELECT COUNT(*) AS costs_with_ingredient FROM event_costs;
SELECT ingredient_name, ingredient_id FROM event_shopping_items WHERE ingredient_id IS NOT NULL LIMIT 5;