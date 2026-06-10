-- ============================================================
-- EventFlow — Fix escandallos / stock (idempotente)
--   psql "$DATABASE_URL" -f scripts/2025-fix-escandallos.sql
--
-- Corrige 3 problemas detectados en la auditoría de escandallos:
--   1. La vista `shopping_list` cruzaba el plato por `item_id` (campo que el
--      configurador NO guarda) en vez de por `name` → el escandallo salía VACÍO.
--   2. La columna `events.stock_deducted` no existía pese a usarla
--      /api/stock/deduct → 500 al deducir stock.
--   3. La tabla `ingredients` puede no contener todos los ingredientes que
--      aparecen en las recetas del catálogo → el cruce con stock no encuentra
--      la materia prima. Se insertan los que falten (sin tocar el stock real).
-- ============================================================

-- 1. Idempotency flag para la deducción de stock ------------------------------
ALTER TABLE events ADD COLUMN IF NOT EXISTS stock_deducted BOOLEAN NOT NULL DEFAULT false;

-- 2. Vista de escandallo corregida (cruce por NAME, fallback a item_id) --------
DROP VIEW IF EXISTS shopping_list;
CREATE VIEW shopping_list AS
WITH event_items AS (
    SELECT eo.event_id, eo.id AS order_id, jsonb_array_elements(e.selected_items) AS item
    FROM event_orders eo
    JOIN events e ON e.id = eo.event_id
    WHERE eo.status IN ('in_progress', 'completed')
),
item_details AS (
    SELECT
        ei.event_id,
        ei.order_id,
        COALESCE(NULLIF(ei.item->>'name', ''), ei.item->>'item_id')::TEXT AS item_name,
        (ei.item->>'quantity')::NUMERIC AS item_qty
    FROM event_items ei
),
ingredient_breakdown AS (
    SELECT
        d.event_id,
        d.order_id,
        d.item_qty,
        (ing->>'name')::TEXT  AS ingredient_name,
        (ing->>'grams')::NUMERIC AS grams,
        (ing->>'count')::NUMERIC AS count,
        (ing->>'ml')::NUMERIC AS ml
    FROM item_details d
    JOIN catalog_items ci ON ci.name = d.item_name
    CROSS JOIN LATERAL jsonb_array_elements(ci.ingredients) AS ing
)
SELECT
    ib.event_id,
    ib.order_id,
    ib.ingredient_name,
    MAX(ing_stock.supplier) AS provider_name,  -- consumido por el regenerate de /api/shopping
    SUM(COALESCE(ib.grams, 0) * ib.item_qty) AS total_grams,
    SUM(COALESCE(ib.count, 0) * ib.item_qty) AS total_units,
    SUM(COALESCE(ib.ml, 0)   * ib.item_qty) AS total_ml
FROM ingredient_breakdown ib
LEFT JOIN ingredients ing_stock ON lower(trim(ing_stock.name)) = lower(trim(ib.ingredient_name))
GROUP BY ib.event_id, ib.order_id, ib.ingredient_name
ORDER BY ib.ingredient_name;

-- 3. Asegurar que toda materia prima de las recetas existe en `ingredients` ----
--    (solo inserta las que falten; NO toca cantidades/stock de las existentes)
INSERT INTO ingredients (name, unit, cost_per_unit, active)
SELECT DISTINCT
    trim((ing->>'name')),
    CASE
        WHEN (ing->>'grams') IS NOT NULL THEN 'gr'
        WHEN (ing->>'ml')    IS NOT NULL THEN 'ml'
        ELSE 'ud'
    END,
    0,
    true
FROM catalog_items ci
CROSS JOIN LATERAL jsonb_array_elements(ci.ingredients) AS ing
WHERE ci.active
  AND (ing->>'name') IS NOT NULL
  AND trim((ing->>'name')) <> ''
ON CONFLICT (name) DO NOTHING;
