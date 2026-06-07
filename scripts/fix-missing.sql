-- Fix missing data

-- Event 2: Pedro Sánchez (was missing)
INSERT INTO events (id, client_name, client_email, client_phone, event_type, guest_count, kids_count, event_date, status, selected_items, total_pvp, total_cost, bar_hours, bar_price, iva_pct, client_id, linen_type, centerpiece)
VALUES ('e0000001-0000-0000-0000-000000000002', 'Pedro Sánchez Moreno', 'pedro.sanchez@gmail.com', '678 90 12 34', 'boda', 40, 5, '2026-09-12', 'sent',
'[{"item_id":"i09","name":"Chacinas y quesos","category":"aperitivo-frio","quantity":4,"unit_price_pvp":4.20,"unit_price_cost":2.00,"subtotal_pvp":16.80,"subtotal_cost":8.00},{"item_id":"i10","name":"Solomillo de vaca vieja","category":"carne","quantity":25,"unit_price_pvp":14.50,"unit_price_cost":6.20,"subtotal_pvp":362.50,"subtotal_cost":155.00},{"item_id":"i11","name":"Lomo de bacalao confitado","category":"pescado","quantity":15,"unit_price_pvp":11.00,"unit_price_cost":4.50,"subtotal_pvp":165.00,"subtotal_cost":67.50},{"item_id":"i12","name":"Tarta de queso","category":"postre","quantity":40,"unit_price_pvp":4.00,"unit_price_cost":1.50,"subtotal_pvp":160.00,"subtotal_cost":60.00}]'::jsonb,
704.30, 290.50, 2, 30.00, 10.00,
'c0000001-0000-0000-0000-000000000004', 'Lino natural', 'Hortensia blanca')
ON CONFLICT DO NOTHING;

-- Quote 1: María García (was missing)
INSERT INTO quotes (id, event_id, lead_id, status, base_pvp, base_cost, bar_price, extras_pvp, extras_cost, iva_pct, total_pvp, total_cost, margin_pct, valid_until, sent_at, accepted_at)
VALUES ('b1000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', 'a1000001-0000-0000-0000-000000000004', 'accepted',
3675.00, 1391.80, 135.00, 285.00, 125.00, 10.00, 4095.00, 1551.80, 62.1, '2026-06-15',
'2026-05-18 10:00:00+02', '2026-05-19 14:30:00+02')
ON CONFLICT DO NOTHING;

-- Quote 2: Pedro Sánchez (was missing)
INSERT INTO quotes (id, event_id, lead_id, status, base_pvp, base_cost, bar_price, extras_pvp, extras_cost, iva_pct, total_pvp, total_cost, margin_pct, valid_until, sent_at)
VALUES ('b1000001-0000-0000-0000-000000000002', 'e0000001-0000-0000-0000-000000000002', 'a1000001-0000-0000-0000-000000000003', 'sent',
704.30, 290.50, 60.00, 0.00, 0.00, 10.00, 704.30, 290.50, 58.8, '2026-06-30',
'2026-05-20 09:00:00+02')
ON CONFLICT DO NOTHING;

-- Fix lead statuses
UPDATE leads SET status = 'convertido', converted_to_client_id = 'c0000001-0000-0000-0000-000000000001' WHERE name = 'María García López' AND status = 'nuevo';
UPDATE leads SET status = 'convertido', converted_to_client_id = 'c0000001-0000-0000-0000-000000000002' WHERE name = 'Eventos CR SL' AND status = 'nuevo';

-- Remove duplicate leads
DELETE FROM leads WHERE name = 'Isabel Moreno Vega' AND id != 'a1000001-0000-0000-0000-000000000001';

-- Add payment for Pedro's event (señal pending)
INSERT INTO payments (event_id, concept, amount, due_date, paid, method, notes)
VALUES ('e0000001-0000-0000-0000-000000000002', 'Señal boda Pedro (40%)', 281.72, '2026-06-01', false, NULL, 'Pendiente transferencia');

-- Verify
SELECT e.client_name, e.status, 
  (SELECT count(*)::int FROM quotes q WHERE q.event_id = e.id) as quotes,
  (SELECT count(*)::int FROM payments p WHERE p.event_id = e.id) as pagos
FROM events e ORDER BY e.event_date;
