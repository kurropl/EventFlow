-- Generate escandallos for existing accepted/completed events
-- (normally this happens on quote accept, but we need to backfill)

DO $$
DECLARE
  ev RECORD;
  item RECORD;
  cat_item RECORD;
  qty INT;
  ings JSONB;
  ing JSONB;
BEGIN
  FOR ev IN 
    SELECT e.id as event_id, e.selected_items, eo.id as order_id
    FROM events e
    JOIN event_orders eo ON eo.event_id = e.id
    WHERE e.selected_items != '[]'::jsonb AND e.selected_items IS NOT NULL
  LOOP
    -- Clear existing escandallo for this event
    DELETE FROM event_shopping_items WHERE event_id = ev.event_id;
    
    FOR item IN SELECT * FROM jsonb_array_elements(ev.selected_items)
    LOOP
      qty := COALESCE((item->>'quantity')::int, 1);
      
      -- Look up catalog ingredients by exact name
      SELECT ingredients, provider_name INTO cat_item
      FROM catalog_items
      WHERE name = item->>'name' AND active = true
        AND ingredients IS NOT NULL AND ingredients != '[]'::jsonb;
      
      IF cat_item IS NOT NULL THEN
        ings := cat_item.ingredients;
        FOR ing IN SELECT * FROM jsonb_array_elements(ings)
        LOOP
          INSERT INTO event_shopping_items
            (event_id, order_id, ingredient_name, provider_name, total_grams, total_units, total_ml, completed)
          VALUES (
            ev.event_id,
            ev.order_id,
            COALESCE(ing->>'name', 'Sin nombre'),
            cat_item.provider_name,
            (COALESCE((ing->>'grams')::numeric, 0)) * qty,
            (COALESCE((ing->>'count')::numeric, 0)) * qty,
            (COALESCE((ing->>'ml')::numeric, 0)) * qty,
            false
          );
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Escandallos generados';
END $$;

-- Verify
SELECT e.client_name, 
  count(ess.id)::int as items_escandallo
FROM events e
LEFT JOIN event_shopping_items ess ON ess.event_id = e.id
WHERE e.status IN ('accepted', 'completed')
GROUP BY e.client_name
ORDER BY e.client_name;
