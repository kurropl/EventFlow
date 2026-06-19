-- ============================================================
-- EventFlow — Fix escandallo: items de menú sin match en catálogo
--   psql "$DATABASE_URL" -f scripts/fix-shopping-list-mismatch.sql
--
-- Problema: la vista shopping_list cruza los items del evento
-- contra catalog_items por nombre exacto. Pero hay items de menú
-- genéricos (ej: "Caña de lomo", "Jamón", "Frito variado", "Postre del día")
-- que NO existen en el catálogo con ese nombre exacto.
--
-- Fix: añadir los items sin match como ingredientes directos
-- (sin desglose de gramos, pues no tienen receta asociada).
-- ============================================================

-- 1. Recrear la vista con fallback para items sin match
DROP VIEW IF EXISTS shopping_list;

CREATE VIEW shopping_list AS
WITH event_items AS (
    SELECT
        eo.event_id,
        eo.id AS order_id,
        jsonb_array_elements(e.selected_items) AS item
    FROM event_orders eo
    JOIN events e ON e.id = eo.event_id
    WHERE eo.status IN ('in_progress', 'completed')
),
item_details AS (
    SELECT
        ei.event_id,
        ei.order_id,
        COALESCE(NULLIF(ei.item->>'name', ''), ei.item->>'item_id')::TEXT AS item_name,
        (ei.item->>'category')::TEXT AS category,
        (ei.item->>'quantity')::NUMERIC AS item_qty
    FROM event_items ei
),
-- Items that DO match a catalog entry → get ingredient breakdown
matched_items AS (
    SELECT
        id.event_id,
        id.order_id,
        id.item_qty,
        ci.id AS catalog_id,
        (ing->>'name')::TEXT AS ingredient_name,
        (ing->>'grams')::NUMERIC AS grams,
        (ing->>'count')::NUMERIC AS count,
        (ing->>'ml')::NUMERIC AS ml
    FROM item_details id
    JOIN catalog_items ci ON ci.name = id.item_name
    CROSS JOIN LATERAL jsonb_array_elements(ci.ingredients) AS ing
),
-- Items that DON'T match any catalog entry → use the item name itself as ingredient
unmatched_items AS (
    SELECT
        id.event_id,
        id.order_id,
        1 AS item_qty,
        NULL::UUID AS catalog_id,
        id.item_name AS ingredient_name,
        0::NUMERIC AS grams,
        1::NUMERIC AS count,  -- 1 unit of the item itself
        0::NUMERIC AS ml
    FROM item_details id
    WHERE NOT EXISTS (
        SELECT 1 FROM catalog_items ci WHERE ci.name = id.item_name
    )
    AND id.item_name IS NOT NULL
)
SELECT
    COALESCE(m.event_id, u.event_id) AS event_id,
    COALESCE(m.order_id, u.order_id) AS order_id,
    COALESCE(m.ingredient_name, u.ingredient_name) AS ingredient_name,
    MAX(COALESCE(ing_stock.supplier, '—'))::TEXT AS provider_name,
    SUM(COALESCE(m.grams, 0) * COALESCE(m.item_qty, 1)) AS total_grams,
    SUM(COALESCE(m.count, 0) * COALESCE(m.item_qty, 1)) + SUM(COALESCE(u.count, 0) * COALESCE(u.item_qty, 1)) AS total_units,
    SUM(COALESCE(m.ml, 0) * COALESCE(m.item_qty, 1)) AS total_ml
FROM (
    SELECT * FROM matched_items
    UNION ALL
    SELECT * FROM unmatched_items
) combined
LEFT JOIN ingredients ing_stock ON lower(trim(ing_stock.name)) = lower(trim(COALESCE(matched_items.ingredient_name, unmatched_items.ingredient_name)))
GROUP BY 
    CASE WHEN m.event_id IS NOT NULL THEN m.event_id ELSE u.event_id END,
    CASE WHEN m.order_id IS NOT NULL THEN m.order_id ELSE u.order_id END,
    CASE WHEN m.ingredient_name IS NOT NULL THEN m.ingredient_name ELSE u.ingredient_name END
ORDER BY ingredient_name;

-- Wait, that's not right. Let me use a cleaner approach.
DROP VIEW IF EXISTS shopping_list;

CREATE VIEW shopping_list AS
WITH event_items AS (
    SELECT
        eo.event_id,
        eo.id AS order_id,
        jsonb_array_elements(e.selected_items) AS item
    FROM event_orders eo
    JOIN events e ON e.id = eo.event_id
    WHERE eo.status IN ('in_progress', 'completed')
),
item_details AS (
    SELECT
        ei.event_id,
        ei.order_id,
        COALESCE(NULLIF(ei.item->>'name', ''), ei.item->>'item_id')::TEXT AS item_name,
        (ei.item->>'category')::TEXT AS category,
        (ei.item->>'quantity')::NUMERIC AS item_qty
    FROM event_items ei
),
ingredient_breakdown AS (
    SELECT
        id.event_id,
        id.order_id,
        id.item_qty,
        ci.id AS catalog_id,
        (ing->>'name')::TEXT AS ingredient_name,
        (ing->>'grams')::NUMERIC AS grams,
        (ing->>'count')::NUMERIC AS count,
        (ing->>'ml')::NUMERIC AS ml
    FROM item_details id
    JOIN catalog_items ci ON ci.name = id.item_name
    CROSS JOIN LATERAL jsonb_array_elements(ci.ingredients) AS ing

    UNION ALL

    -- Items without a catalog match → use item name as ingredient (1 unit)
    SELECT
        id.event_id,
        id.order_id,
        id.item_qty,
        NULL::UUID AS catalog_id,
        id.item_name AS ingredient_name,
        0::NUMERIC AS grams,
        1::NUMERIC AS count,
        0::NUMERIC AS ml
    FROM item_details id
    WHERE NOT EXISTS (
        SELECT 1 FROM catalog_items ci WHERE ci.name = id.item_name
    )
    AND id.item_name IS NOT NULL
)
SELECT
    ib.event_id,
    ib.order_id,
    ib.ingredient_name,
    MAX(COALESCE(ing_stock.supplier, '—'))::TEXT AS provider_name,
    SUM(COALESCE(ib.grams, 0) * ib.item_qty) AS total_grams,
    SUM(COALESCE(ib.count, 0) * ib.item_qty) AS total_units,
    SUM(COALESCE(ib.ml, 0) * ib.item_qty) AS total_ml
FROM ingredient_breakdown ib
LEFT JOIN ingredients ing_stock ON lower(trim(ing_stock.name)) = lower(trim(ib.ingredient_name))
GROUP BY ib.event_id, ib.order_id, ib.ingredient_name
ORDER BY ib.ingredient_name;

-- 2. Regenerar event_shopping_items para las órdenes existentes
DELETE FROM event_shopping_items;
INSERT INTO event_shopping_items (event_id, order_id, ingredient_name, provider_name, total_grams, total_units, total_ml)
SELECT DISTINCT event_id, order_id, ingredient_name, provider_name, total_grams, total_units, total_ml
FROM shopping_list
ON CONFLICT DO NOTHING;

-- 3. También arreglar la Carrillera (item menú vs catálogo difieren en "de patatas")
-- UPDATE events SET selected_items = (
--   SELECT jsonb_agg(
--     CASE 
--       WHEN item->>'name' = 'Carrillera a baja temperatura con puré trufado'
--       THEN jsonb_set(item, '{name}', '"Carrillera a baja temperatura con puré de patatas trufado"')
--       ELSE item
--     END
--   )
--   FROM jsonb_array_elements(selected_items) AS item
-- ) WHERE selected_items @> '[{"name": "Carrillera a baja temperatura con puré trufado"}]'::jsonb;
-- Nota: mejor corregir en el frontend el proposed_menu para que use el nombre correcto del catálogo