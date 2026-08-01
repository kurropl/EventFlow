-- EventFlow — 2026-08-01: Unificar recipe_items como vista con catalog_item_id
--
-- Contexto: en producción, `recipe_items` es una VISTA sobre la tabla base
-- `recipe_ingredients`. La vista exponía solo (id, recipe_id, ingredient_id,
-- quantity, unit, per_guest, cost), pero las rutas del módulo Cocina
-- (recetas, escandallos, freeze, trazabilidad) consultan `catalog_item_id`,
-- `qty_base` y `unit_dimension` — columnas que las rutas esperaban del
-- esquema legacy de la BD seed (donde recipe_items era una tabla real).
-- Resultado: el GET de escandallo y varias rutas de cocina fallaban con
-- "column ri.catalog_item_id does not exist" para CUALQUIER evento.
--
-- Solución (aditiva, no destructiva): ampliar la vista con las columnas
-- derivadas desde `recipes.catalog_item_id` y la unidad del ingrediente.
-- La tabla base recipe_ingredients NO se toca.
--
-- Es idempotente: CREATE OR REPLACE VIEW.

CREATE OR REPLACE VIEW recipe_items AS
SELECT ri.id,
       ri.recipe_id,
       ri.ingredient_id,
       ri.quantity,
       ri.unit,
       ri.per_guest,
       ri.cost,
       r.catalog_item_id,
       COALESCE(ri.quantity, 0) AS qty_base,
       CASE WHEN ri.unit IN ('g', 'gr', 'grams') THEN 'mass'
            WHEN ri.unit IN ('ml', 'l') THEN 'volume'
            ELSE 'count' END AS unit_dimension
FROM recipe_ingredients ri
LEFT JOIN recipes r ON r.id = ri.recipe_id;

-- Verificación
SELECT column_name FROM information_schema.columns
WHERE table_name = 'recipe_items' ORDER BY ordinal_position;
