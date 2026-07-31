-- ============================================================
-- EventFlow — Migración: catalog_items.ingredients (JSONB)
--              → recipes + recipe_ingredients
-- Fecha: 2026-07-21
--
-- Idempotente: usa IF NOT EXISTS y ON CONFLICT DO NOTHING.
-- ============================================================

-- Asegurar que la columna cost_per_serving existe
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS cost_per_serving NUMERIC(12,4) NOT NULL DEFAULT 0;

-- ============================================================
-- 1. Crear recipes desde catalog_items
-- ============================================================
INSERT INTO recipes (id, name, description, category, catalog_item_id, published, active, created_at, updated_at)
SELECT
  ci.id,
  ci.name,
  ci.description,
  ci.category,
  ci.id,
  true,
  ci.active,
  ci.created_at,
  ci.updated_at
FROM catalog_items ci
WHERE ci.active = true
  AND ci.ingredients IS NOT NULL
  AND ci.ingredients != '[]'::jsonb
  AND ci.id NOT IN (SELECT catalog_item_id FROM recipes WHERE catalog_item_id IS NOT NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. Migrar cada ingrediente individual del JSONB
-- ============================================================
DO $$
DECLARE
  r RECORD;
  ing JSONB;
  ing_name TEXT;
  ing_grams NUMERIC;
  ing_count NUMERIC;
  ing_ml NUMERIC;
  ing_qty NUMERIC;
  ing_unit TEXT;
  ing_id UUID;
  ing_cost NUMERIC;
  receta_count INT := 0;
  ingrediente_count INT := 0;
BEGIN
  FOR r IN
    SELECT ci.id AS catalog_item_id, ci.ingredients
    FROM catalog_items ci
    WHERE ci.active = true
      AND ci.ingredients IS NOT NULL
      AND ci.ingredients != '[]'::jsonb
  LOOP
    receta_count := receta_count + 1;

    FOR ing IN SELECT * FROM jsonb_array_elements(r.ingredients)
    LOOP
      ing_name := ing->>'name';
      ing_grams := COALESCE((ing->>'grams')::NUMERIC, 0);
      ing_count := COALESCE((ing->>'count')::NUMERIC, 0);
      ing_ml := COALESCE((ing->>'ml')::NUMERIC, 0);

      IF ing_grams > 0 THEN
        ing_qty := ing_grams;
        ing_unit := 'g';
      ELSIF ing_ml > 0 THEN
        ing_qty := ing_ml;
        ing_unit := 'ml';
      ELSE
        ing_qty := ing_count;
        ing_unit := 'ud';
      END IF;

      IF ing_qty <= 0 OR ing_name IS NULL THEN
        CONTINUE;
      END IF;

      SELECT i.id, COALESCE(i.unit_cost, i.cost_per_unit, 0)
      INTO ing_id, ing_cost
      FROM ingredients i
      WHERE LOWER(TRIM(i.name)) = LOWER(TRIM(ing_name))
      LIMIT 1;

      IF ing_id IS NULL THEN
        SELECT i.id, COALESCE(i.unit_cost, i.cost_per_unit, 0)
        INTO ing_id, ing_cost
        FROM ingredients i
        WHERE i.name ILIKE '%' || TRIM(ing_name) || '%'
        LIMIT 1;
      END IF;

      IF ing_id IS NOT NULL THEN
        INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, per_guest, cost)
        VALUES (
          r.catalog_item_id,
          ing_id,
          ing_qty,
          ing_unit,
          true,
          ROUND(ing_qty * ing_cost, 4)
        )
        ON CONFLICT (recipe_id, ingredient_id) DO NOTHING;
        ingrediente_count := ingrediente_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Migracion completada: % recetas, % ingredientes migrados', receta_count, ingrediente_count;
END $$;

-- ============================================================
-- 3. Calcular coste de cada receta
-- ============================================================
UPDATE recipes r
SET cost_per_serving = (
  SELECT COALESCE(SUM(ri.quantity * COALESCE(i.unit_cost, i.cost_per_unit, 0)), 0)
  FROM recipe_ingredients ri
  JOIN ingredients i ON i.id = ri.ingredient_id
  WHERE ri.recipe_id = r.id
)
WHERE r.id IN (SELECT recipe_id FROM recipe_ingredients);

-- ============================================================
-- 4. Verificación
-- ============================================================
SELECT 'RESULTADO:' as info;
SELECT COUNT(*) || ' recipes creados' FROM recipes;
SELECT COUNT(*) || ' recipe_ingredients creados' FROM recipe_ingredients;
SELECT
  COUNT(*) || ' platos SIN receta (ingredients vacio o nulo)'
FROM catalog_items
WHERE active = true
  AND (ingredients IS NULL OR ingredients = '[]'::jsonb);