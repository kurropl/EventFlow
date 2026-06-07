-- Fix missing dependent records

-- Quotes
INSERT INTO quotes (id, event_id, lead_id, status, base_pvp, base_cost, bar_price, extras_pvp, extras_cost, iva_pct, total_pvp, total_cost, margin_pct, valid_until, sent_at, accepted_at)
VALUES ('a0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', NULL, 'accepted', 3675.00, 1391.80, 135.00, 285.00, 125.00, 10.00, 4095.00, 1551.80, 62.1, '2026-06-15', '2026-05-18 10:00:00+02', '2026-05-19 14:30:00+02');

INSERT INTO quotes (id, event_id, lead_id, status, base_pvp, base_cost, bar_price, extras_pvp, extras_cost, iva_pct, total_pvp, total_cost, margin_pct, valid_until, sent_at)
VALUES ('a0000001-0000-0000-0000-000000000002', 'e0000001-0000-0000-0000-000000000003', 'l0000001-0000-0000-0000-000000000004', 'sent', 704.30, 290.50, 60.00, 0.00, 0.00, 10.00, 704.30, 290.50, 58.8, '2026-06-30', '2026-05-20 09:00:00+02');

INSERT INTO quotes (id, event_id, lead_id, status, base_pvp, base_cost, bar_price, extras_pvp, extras_cost, iva_pct, total_pvp, total_cost, margin_pct, valid_until, sent_at)
VALUES ('a0000001-0000-0000-0000-000000000004', 'e0000001-0000-0000-0000-000000000004', NULL, 'accepted', 2178.00, 945.00, 240.00, 0.00, 0.00, 10.00, 2178.00, 945.00, 56.6, '2026-04-30', '2026-04-25 10:00:00+02', '2026-04-26 16:00:00+02');

-- Event Orders
INSERT INTO event_orders (id, event_id, quote_id, client_id, confirmed_price, final_price, status, tables_suggested, tables_confirmed, waiters_suggested, waiters_confirmed)
VALUES ('e00a0001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', 4095.00, 4095.00, 'completed', 12, 12, 4, 4);

INSERT INTO event_orders (id, event_id, quote_id, client_id, confirmed_price, final_price, status, tables_suggested, tables_confirmed, waiters_suggested, waiters_confirmed)
VALUES ('e00a0001-0000-0000-0000-000000000002', 'e0000001-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000004', 'c0000001-0000-0000-0000-000000000002', 2178.00, 2178.00, 'completed', 6, 6, 3, 3);

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
