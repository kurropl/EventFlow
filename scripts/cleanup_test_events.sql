DO $$
DECLARE
  test_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO test_ids FROM events WHERE client_name LIKE 'Test TC-%' OR client_name LIKE 'Debug%';
  IF test_ids IS NULL OR array_length(test_ids,1) = 0 THEN
    RAISE NOTICE 'No test events to clean';
    RETURN;
  END IF;
  DELETE FROM checklist_tasks WHERE event_id = ANY(test_ids);
  DELETE FROM staffing_assignments WHERE staffing_line_id IN (SELECT id FROM staffing_lines WHERE event_id = ANY(test_ids));
  DELETE FROM staffing_offers WHERE staffing_line_id IN (SELECT id FROM staffing_lines WHERE event_id = ANY(test_ids));
  DELETE FROM staffing_pay WHERE event_id = ANY(test_ids);
  DELETE FROM staffing_lines WHERE event_id = ANY(test_ids);
  DELETE FROM event_shopping_items WHERE event_id = ANY(test_ids);
  DELETE FROM payments WHERE event_id = ANY(test_ids);
  DELETE FROM event_orders WHERE event_id = ANY(test_ids);
  DELETE FROM event_operations WHERE event_id = ANY(test_ids);
  DELETE FROM event_menu_items WHERE event_id = ANY(test_ids);
  DELETE FROM guest_forms WHERE event_id = ANY(test_ids);
  DELETE FROM guests WHERE event_id = ANY(test_ids);
  DELETE FROM quotes WHERE event_id = ANY(test_ids);
  DELETE FROM clients WHERE id IN (SELECT client_id FROM events WHERE id = ANY(test_ids));
  DELETE FROM events WHERE id = ANY(test_ids);
  RAISE NOTICE 'Cleaned % test events', array_length(test_ids,1);
END
$$;
