-- ============================================================
-- MIGRATION: Stock & Escandallos — Fixed constraints
-- ============================================================

-- 1. Populate providers from catalog_items provider_name
INSERT INTO providers (name, category, active)
SELECT DISTINCT provider_name, 'catering', true
FROM catalog_items
WHERE active = true AND provider_name IS NOT NULL AND provider_name != ''
ON CONFLICT DO NOTHING;

-- 2. Populate ingredients from catalog_items ingredients JSONB
INSERT INTO ingredients (name, unit, cost_per_unit, supplier, active, quantity, min_stock)
SELECT DISTINCT ON (ing->>'name')
  ing->>'name' as name,
  CASE
    WHEN (ing->>'grams')::numeric > 0 THEN 'gr'
    WHEN (ing->>'ml')::numeric > 0 THEN 'ml'
    WHEN (ing->>'count')::numeric > 0 THEN 'ud'
    ELSE 'ud'
  END as unit,
  0 as cost_per_unit,
  ci.provider_name as supplier,
  true as active,
  FLOOR(RANDOM() * 500 + 50)::int as quantity,
  FLOOR(RANDOM() * 100 + 10)::int as min_stock
FROM catalog_items ci,
     jsonb_array_elements(ci.ingredients) AS ing
WHERE ci.active = true AND ci.ingredients IS NOT NULL AND ci.ingredients != '[]'::jsonb
  AND (ing->>'name') IS NOT NULL AND (ing->>'name') != ''
ON CONFLICT (name) DO NOTHING;

-- 3. Set some ingredients below min_stock for demo alerts
UPDATE ingredients SET quantity = 5, min_stock = 20 
WHERE name IN ('jamón ibérico', 'carrillera', 'merluza', 'limón', 'cava', 'arroz bomba');

UPDATE ingredients SET quantity = 2, min_stock = 15
WHERE name IN ('becerrina', 'presa ibérica');

-- 4. Verify
SELECT 'providers' as tbl, count(*)::int as n FROM providers
UNION ALL SELECT 'ingredients', count(*)::int FROM ingredients
UNION ALL SELECT 'low_stock', count(*)::int FROM ingredients WHERE quantity <= min_stock;

-- Sample ingredients
SELECT name, unit, quantity, min_stock, 
  CASE WHEN quantity <= min_stock THEN '⚠️ BAJO' ELSE '✓ OK' END as status,
  supplier
FROM ingredients ORDER BY name LIMIT 15;
