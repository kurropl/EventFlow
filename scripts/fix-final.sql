-- Final fix: correct event types + bar_hours + valid UUIDs

-- Event 2: Comunión (with accent)
INSERT INTO events (id, client_name, client_email, client_phone, event_type, guest_count, kids_count, event_date, status, selected_items, total_pvp, total_cost, bar_hours, bar_price, iva_pct, client_id, linen_type, centerpiece)
VALUES ('e0000001-0000-0000-0000-000000000002', 'Ana Martínez Ruiz', 'ana.martinez@hotmail.com', '612 23 45 67', 'comunión', 50, 12, '2026-06-15', 'draft', '[]'::jsonb, 0.00, 0.00, 0, 0.00, 10.00, 'c0000001-0000-0000-0000-000000000003', NULL, NULL);

-- Event 4: Corporativo (bar_hours=3 max)
INSERT INTO events (id, client_name, client_email, client_phone, event_type, guest_count, kids_count, event_date, status, selected_items, total_pvp, total_cost, bar_hours, bar_price, iva_pct, client_id, linen_type, centerpiece)
VALUES ('e0000001-0000-0000-0000-000000000004', 'Eventos CR SL', 'carlos.rm@outlook.com', '645 67 89 01', 'corporativo', 60, 0, '2026-05-10', 'completed',
'[{"item_id":"cat-mariscos","name":"Estación de mariscos","category":"complemento","quantity":1,"unit_price_pvp":175.00,"unit_price_cost":75.00,"subtotal_pvp":175.00,"subtotal_cost":75.00},{"item_id":"cat-presa","name":"Presa a la brasa","category":"carne","quantity":60,"unit_price_pvp":13.50,"unit_price_cost":5.80,"subtotal_pvp":810.00,"subtotal_cost":348.00},{"item_id":"cat-arroz","name":"Arroz meloso de mariscos","category":"arroz","quantity":60,"unit_price_pvp":9.00,"unit_price_cost":3.80,"subtotal_pvp":540.00,"subtotal_cost":228.00},{"item_id":"cat-chocolate","name":"Mucho chocolate","category":"postre","quantity":60,"unit_price_pvp":4.50,"unit_price_cost":1.80,"subtotal_pvp":270.00,"subtotal_cost":108.00},{"item_id":"cat-cerveza","name":"Cerveza con y sin","category":"bebida","quantity":60,"unit_price_pvp":2.50,"unit_price_cost":0.80,"subtotal_pvp":150.00,"subtotal_cost":48.00}]'::jsonb,
2178.00, 945.00, 3, 60.00, 10.00, 'c0000001-0000-0000-0000-000000000002', NULL, NULL);

-- Now add dependent records for events that now exist

-- Quotes (only new ones, skip duplicates)
INSERT INTO quotes (id, event_id, lead_id, status, base_pvp, base_cost, bar_price, extras_pvp, extras_cost, iva_pct, total_pvp, total_cost, margin_pct, valid_until, sent_at)
VALUES ('a0000001-0000-0000-0000-000000000002', 'e0000001-0000-0000-0000-000000000003', NULL, 'sent', 704.30, 290.50, 60.00, 0.00, 0.00, 10.00, 704.30, 290.50, 58.8, '2026-06-30', '2026-05-20 09:00:00+02')
ON CONFLICT DO NOTHING;

INSERT INTO quotes (id, event_id, lead_id, status, base_pvp, base_cost, bar_price, extras_pvp, extras_cost, iva_pct, total_pvp, total_cost, margin_pct, valid_until, sent_at)
VALUES ('a0000001-0000-0000-0000-000000000004', 'e0000001-0000-0000-0000-000000000004', NULL, 'accepted', 2178.00, 945.00, 240.00, 0.00, 0.00, 10.00, 2178.00, 945.00, 56.6, '2026-04-30', '2026-04-25 10:00:00+02')
ON CONFLICT DO NOTHING;

-- Event Orders
INSERT INTO event_orders (id, event_id, quote_id, client_id, confirmed_price, final_price, status, tables_suggested, tables_confirmed, waiters_suggested, waiters_confirmed)
VALUES ('e00a0001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', 4095.00, 4095.00, 'completed', 12, 12, 4, 4)
ON CONFLICT DO NOTHING;

INSERT INTO event_orders (id, event_id, quote_id, client_id, confirmed_price, final_price, status, tables_suggested, tables_confirmed, waiters_suggested, waiters_confirmed)
VALUES ('e00a0001-0000-0000-0000-000000000002', 'e0000001-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000004', 'c0000001-0000-0000-0000-000000000002', 2178.00, 2178.00, 'completed', 6, 6, 3, 3)
ON CONFLICT DO NOTHING;

-- Payments
INSERT INTO payments (event_id, concept, amount, due_date, paid, paid_date, method, notes)
VALUES
('e0000001-0000-0000-0000-000000000001', 'Señal boda (40%)', 1638.00, '2026-05-20', true, '2026-05-19', 'transferencia', 'Transferencia BBVA'),
('e0000001-0000-0000-0000-000000000001', 'Saldo boda (60%)', 2457.00, '2026-06-15', true, '2026-06-10', 'transferencia', 'Transferencia BBVA'),
('e0000001-0000-0000-0000-000000000004', 'Señal corporativo (40%)', 871.20, '2026-04-28', true, '2026-04-27', 'tarjeta', 'Visa ****4521'),
('e0000001-0000-0000-0000-000000000004', 'Saldo corporativo (60%)', 1306.80, '2026-05-08', true, '2026-05-07', 'transferencia', 'Transferencia Caixabank'),
('e0000001-0000-0000-0000-000000000004', 'Extra consumiciones bar', 120.00, '2026-05-15', true, '2026-05-12', 'efectivo', ''),
('e0000001-0000-0000-0000-000000000003', 'Señal boda (40%)', 281.72, '2026-06-01', false, NULL, NULL, 'Pendiente transferencia');

-- Invoices
INSERT INTO invoices (event_order_id, event_id, client_id, invoice_number, fiscal_name, fiscal_nif, fiscal_address, subtotal, iva_pct, iva_amount, total, extras_pvp, payments_total, balance_due, status, paid_at)
VALUES
('e00a0001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', 'FE-2026-5066', 'María García López', 'Y1234567X', 'Calle Sierpes 42, Sevilla', 4095.00, 10.00, 409.50, 4504.50, 0.00, 4095.00, 0.00, 'paid', '2026-06-10'),
('e00a0001-0000-0000-0000-000000000002', 'e0000001-0000-0000-0000-000000000004', 'c0000001-0000-0000-0000-000000000002', 'FE-2026-5067', 'Eventos CR SL', 'B9876543M', 'Avda. de la Constitución 15, Sevilla', 2178.00, 10.00, 217.80, 2395.80, 120.00, 2298.00, 97.80, 'paid', '2026-05-12');
