-- ============================================================
-- MIGRATION: Stock & Escandallos — Add quantity/min_stock + populate
-- ============================================================

-- 1. Add stock columns to ingredients
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS quantity numeric DEFAULT 0;
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS min_stock numeric DEFAULT 0;
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS last_restocked timestamp with time zone;

-- 2. Populate providers from catalog_items provider_name
INSERT INTO providers (name, category, active)
SELECT DISTINCT provider_name, 'general', true
FROM catalog_items
WHERE active = true AND provider_name IS NOT NULL AND provider_name != ''
ON CONFLICT DO NOTHING;

-- 3. Populate ingredients from catalog_items ingredients JSONB
-- Flatten all ingredients across all catalog items
INSERT INTO ingredients (name, unit, cost_per_unit, supplier, active, quantity, min_stock)
SELECT
  ing->>'name' as name,
  CASE
    WHEN (ing->>'grams')::numeric > 0 THEN 'g'
    WHEN (ing->>'ml')::numeric > 0 THEN 'ml'
    WHEN (ing->>'count')::numeric > 0 THEN 'ud'
    ELSE 'ud'
  END as unit,
  0 as cost_per_unit,
  ci.provider_name as supplier,
  true as active,
  0 as quantity,
  0 as min_stock
FROM catalog_items ci,
     jsonb_array_elements(ci.ingredients) AS ing
WHERE ci.active = true AND ci.ingredients IS NOT NULL AND ci.ingredients != '[]'::jsonb
  AND (ing->>'name') IS NOT NULL AND (ing->>'name') != ''
ON CONFLICT DO NOTHING;

-- 4. Add unique constraint on ingredient name if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ingredients_name_unique') THEN
    ALTER TABLE ingredients ADD CONSTRAINT ingredients_name_unique UNIQUE (name);
  END IF;
END $$;

-- 5. Verify
SELECT 'providers' as tbl, count(*)::int as n FROM providers
UNION ALL SELECT 'ingredients', count(*)::int FROM ingredients
UNION ALL SELECT 'catalog_items (with ings)', count(*)::int FROM catalog_items WHERE active=true AND ingredients IS NOT NULL AND ingredients != '[]'::jsonb;
