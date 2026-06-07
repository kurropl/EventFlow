-- Generate escandallos using Python-style approach via SQL
-- Simpler: loop with proper casting

DELETE FROM event_shopping_items;

INSERT INTO event_shopping_items (event_id, order_id, ingredient_name, provider_name, total_grams, total_units, total_ml, completed)
SELECT 
  ev.event_id,
  ev.order_id,
  ing->>'name' as ingredient_name,
  cat.provider_name,
  (COALESCE((ing->>'grams')::numeric, 0) * qty) as total_grams,
  (COALESCE((ing->>'count')::numeric, 0) * qty) as total_units,
  (COALESCE((ing->>'ml')::numeric, 0) * qty) as total_ml,
  false
FROM (
  SELECT 
    e.id as event_id,
    eo.id as order_id,
    item->>'name' as catalog_name,
    COALESCE((item->>'quantity')::int, 1) as qty
  FROM events e
  JOIN event_orders eo ON eo.event_id = e.id
  JOIN jsonb_array_elements(e.selected_items) AS item ON true
  WHERE e.selected_items != '[]'::jsonb AND e.selected_items IS NOT NULL
) ev
JOIN catalog_items cat ON cat.name = ev.catalog_name AND cat.active = true
  AND cat.ingredients IS NOT NULL AND cat.ingredients != '[]'::jsonb
JOIN jsonb_array_elements(cat.ingredients) AS ing ON true;

-- Verify
SELECT e.client_name,
  count(ess.id)::int as escandallo_items
FROM events e
LEFT JOIN event_shopping_items ess ON ess.event_id = e.id
WHERE e.status IN ('accepted', 'completed')
GROUP BY e.client_name ORDER BY e.client_name;

-- Show sample items
SELECT ess.ingredient_name, ess.total_grams, ess.total_units, ess.total_ml
FROM event_shopping_items ess
LIMIT 15;
