-- ============================================================
-- RESET COMPLETO + CICLO DE NEGOCIO CORRECTO
-- ============================================================

-- ═══ LIMPIAR TODO ═══
DELETE FROM guest_forms;
DELETE FROM event_shopping_items;
DELETE FROM payments;
DELETE FROM invoices;
DELETE FROM event_orders;
DELETE FROM quotes;
DELETE FROM waiters;
DELETE FROM events;
DELETE FROM leads;
DELETE FROM clients;

-- ═══ CLIENTES (solo los que ya tienen ciclo completado) ═══
INSERT INTO clients (id, name, email, phone, company, fiscal_name, fiscal_nif, fiscal_address, tags, notes) VALUES
('c0000001-0000-0000-0000-000000000001', 'María García López', 'maria.garcia@gmail.com', '622 34 56 78', NULL, 'María García López', 'Y1234567X', 'Calle Sierpes 42, Sevilla', '["boda","vip"]', 'Boda con 120 invitados. Cliente referido.'),
('c0000001-0000-0000-0000-000000000002', 'Eventos CR SL', 'carlos.rm@outlook.com', '645 67 89 01', 'Eventos CR SL', 'Eventos CR SL', 'B9876543M', 'Avda. de la Constitución 15, Sevilla', '["corporativo"]', 'Empresa de eventos. Frecuencia mensual.');

-- ═══ LEADS (pipeline de ventas) ═══
-- Lead 1: NUEVO — viene del configurador web
INSERT INTO leads (id, name, email, phone, source, status, event_type, guest_count, event_date, notes) VALUES
('a1000001-0000-0000-0000-000000000001', 'Isabel Moreno Vega', 'isabel.moreno@gmail.com', '691 23 45 67', 'configurador', 'nuevo', 'boda', 100, '2026-09-15', 'Rellenó configurador web. Interesada en boda de verano.');

-- Lead 2: CONTACTADO — llamada telefónica
INSERT INTO leads (id, name, email, phone, source, status, event_type, guest_count, event_date, notes) VALUES
('a1000001-0000-0000-0000-000000000002', 'Carmen Díaz Navarro', 'carmen.diaz@gmail.com', '643 21 09 87', 'whatsapp', 'contactado', 'bodas', 80, '2026-10-10', 'Llamada 15/05. Quiere paquete premium.');

-- Lead 3: PRESUPUESTADO — quote enviado
INSERT INTO leads (id, name, email, phone, source, status, event_type, guest_count, event_date, notes) VALUES
('a1000001-0000-0000-0000-000000000003', 'Pedro Sánchez Moreno', 'pedro.sanchez@gmail.com', '678 90 12 34', 'configurador', 'presupuestado', 'boda', 40, '2026-09-12', 'Quote enviado 20/05. Esperando respuesta.');

-- Lead 4: CONVERTIDO — ya es cliente
INSERT INTO leads (id, name, email, phone, source, status, event_type, guest_count, event_date, converted_to_client_id, notes) VALUES
('a1000001-0000-0000-0000-000000000004', 'María García López', 'maria.garcia@gmail.com', '622 34 56 78', 'whatsapp', 'convertido', 'boda', 120, '2026-06-21', 'c0000001-0000-0000-0000-000000000001', 'Convertida a cliente tras aceptar quote.');

-- Lead 5: PERDIDO
INSERT INTO leads (id, name, email, phone, source, status, event_type, guest_count, event_date, notes) VALUES
('a1000001-0000-0000-0000-000000000005', 'Marcos Gil Estévez', 'marcos.gil@gmail.com', '619 87 65 43', 'whatsapp', 'perdido', 'boda', 70, '2026-08-01', 'Eligió otro salón. Presupuesto demasiado ajustado.');

-- ═══ EVENTOS ═══

-- Evento 1: BODA María García — ACEPTADO (quote aceptada, operación configurada)
INSERT INTO events (id, client_name, client_email, client_phone, event_type, guest_count, kids_count, event_date, status, selected_items, total_pvp, total_cost, bar_hours, bar_price, iva_pct, client_id, linen_type, centerpiece, client_token) VALUES
('e0000001-0000-0000-0000-000000000001', 'María García López', 'maria.garcia@gmail.com', '622 34 56 78', 'boda', 120, 15, '2026-06-21', 'accepted',
'[{"item_id":"i01","name":"Jamón ibérico 75% bellota","category":"aperitivo-frio","quantity":6,"unit_price_pvp":5.50,"unit_price_cost":2.80,"subtotal_pvp":33.00,"subtotal_cost":16.80},{"item_id":"i02","name":"Croquetas de jamón ibérico","category":"aperitivo-caliente","quantity":10,"unit_price_pvp":2.20,"unit_price_cost":0.70,"subtotal_pvp":22.00,"subtotal_cost":7.00},{"item_id":"i03","name":"Carrillera a baja temperatura","category":"carne","quantity":80,"unit_price_pvp":12.50,"unit_price_cost":5.00,"subtotal_pvp":1000.00,"subtotal_cost":400.00},{"item_id":"i04","name":"Merluza rellena de mariscos","category":"pescado","quantity":40,"unit_price_pvp":11.50,"unit_price_cost":4.80,"subtotal_pvp":460.00,"subtotal_cost":192.00},{"item_id":"i05","name":"Sorbete de limón","category":"sorbete","quantity":120,"unit_price_pvp":2.50,"unit_price_cost":0.80,"subtotal_pvp":300.00,"subtotal_cost":96.00},{"item_id":"i06","name":"Tarta de celebración","category":"postre","quantity":120,"unit_price_pvp":5.00,"unit_price_cost":2.00,"subtotal_pvp":600.00,"subtotal_cost":240.00},{"item_id":"i07","name":"Cava brindis","category":"bebida","quantity":120,"unit_price_pvp":3.50,"unit_price_cost":1.20,"subtotal_pvp":420.00,"subtotal_cost":144.00},{"item_id":"i08","name":"Vino tinto Lomas del Marquez","category":"bebida","quantity":120,"unit_price_pvp":4.50,"unit_price_cost":1.80,"subtotal_pvp":540.00,"subtotal_cost":216.00}]'::jsonb,
4095.00, 1551.80, 3, 45.00, 10.00,
'c0000001-0000-0000-0000-000000000001', 'Blanco ivory', 'Rosa gardenia',
'a1b2c3d4-e5f6-7890-abcd-ef1234567890');

-- Evento 2: BODA Pedro Sánchez — ENVIADO (quote enviado, esperando aceptación)
INSERT INTO events (id, client_name, client_email, client_phone, event_type, guest_count, kids_count, event_date, status, selected_items, total_pvp, total_cost, bar_hours, bar_price, iva_pct, client_id, linen_type, centerpiece) VALUES
('e0000001-0000-0000-0000-000000000002', 'Pedro Sánchez Moreno', 'pedro.sanchez@gmail.com', '678 90 12 34', 'boda', 40, 5, '2026-09-12', 'sent',
'[{"item_id":"i09","name":"Chacinas y quesos","category":"aperitivo-frio","quantity":4,"unit_price_pvp":4.20,"unit_price_cost":2.00,"subtotal_pvp":16.80,"subtotal_cost":8.00},{"item_id":"i10","name":"Solomillo de vaca vieja","category":"carne","quantity":25,"unit_price_pvp":14.50,"unit_price_cost":6.20,"subtotal_pvp":362.50,"subtotal_cost":155.00},{"item_id":"i11","name":"Lomo de bacalao confitado","category":"pescado","quantity":15,"unit_price_pvp":11.00,"unit_price_cost":4.50,"subtotal_pvp":165.00,"subtotal_cost":67.50},{"item_id":"i12","name":"Tarta de queso","category":"postre","quantity":40,"unit_price_pvp":4.00,"unit_price_cost":1.50,"subtotal_pvp":160.00,"subtotal_cost":60.00}]'::jsonb,
704.30, 290.50, 2, 30.00, 10.00,
'c0000001-0000-0000-0000-000000000004', 'Lino natural', 'Hortensia blanca');

-- Evento 3: CORPORATIVO Eventos CR — COMPLETADO (pagado, factura emitida)
INSERT INTO events (id, client_name, client_email, client_phone, event_type, guest_count, kids_count, event_date, status, selected_items, total_pvp, total_cost, bar_hours, bar_price, iva_pct, client_id, linen_type, centerpiece) VALUES
('e0000001-0000-0000-0000-000000000003', 'Eventos CR SL', 'carlos.rm@outlook.com', '645 67 89 01', 'corporativo', 60, 0, '2026-05-10', 'completed',
'[{"item_id":"i13","name":"Estación de mariscos","category":"complemento","quantity":1,"unit_price_pvp":175.00,"unit_price_cost":75.00,"subtotal_pvp":175.00,"subtotal_cost":75.00},{"item_id":"i14","name":"Presa a la brasa","category":"carne","quantity":60,"unit_price_pvp":13.50,"unit_price_cost":5.80,"subtotal_pvp":810.00,"subtotal_cost":348.00},{"item_id":"i15","name":"Arroz meloso de mariscos","category":"arroz","quantity":60,"unit_price_pvp":9.00,"unit_price_cost":3.80,"subtotal_pvp":540.00,"subtotal_cost":228.00},{"item_id":"i16","name":"Mucho chocolate","category":"postre","quantity":60,"unit_price_pvp":4.50,"unit_price_cost":1.80,"subtotal_pvp":270.00,"subtotal_cost":108.00},{"item_id":"i17","name":"Cerveza con y sin","category":"bebida","quantity":60,"unit_price_pvp":2.50,"unit_price_cost":0.80,"subtotal_pvp":150.00,"subtotal_cost":48.00}]'::jsonb,
2178.00, 945.00, 3, 60.00, 10.00,
'c0000001-0000-0000-0000-000000000002', NULL, NULL);

-- Evento 4: BODA Isabel Moreno — BORRADOR (lead nuevo, aún sin quote)
INSERT INTO events (id, client_name, client_email, client_phone, event_type, guest_count, kids_count, event_date, status, selected_items, total_pvp, total_cost, bar_hours, bar_price, iva_pct) VALUES
('e0000001-0000-0000-0000-000000000004', 'Isabel Moreno Vega', 'isabel.moreno@gmail.com', '691 23 45 67', 'boda', 100, 10, '2026-09-15', 'draft',
'[]'::jsonb, 0.00, 0.00, 0, 0.00, 10.00);

-- Evento 5: BODA Carmen Díaz — BORRADOR (lead contactado, configurando)
INSERT INTO events (id, client_name, client_email, client_phone, event_type, guest_count, kids_count, event_date, status, selected_items, total_pvp, total_cost, bar_hours, bar_price, iva_pct) VALUES
('e0000001-0000-0000-0000-000000000005', 'Carmen Díaz Navarro', 'carmen.diaz@gmail.com', '643 21 09 87', 'boda', 80, 8, '2026-10-10', 'draft',
'[]'::jsonb, 0.00, 0.00, 0, 0.00, 10.00);

-- ═══ QUOTES ═══

-- Quote 1: María García — ACEPTADA
INSERT INTO quotes (id, event_id, lead_id, status, base_pvp, base_cost, bar_price, extras_pvp, extras_cost, iva_pct, total_pvp, total_cost, margin_pct, valid_until, sent_at, accepted_at) VALUES
('b1000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', 'a1000001-0000-0000-0000-000000000004', 'accepted',
3675.00, 1391.80, 135.00, 285.00, 125.00, 10.00, 4095.00, 1551.80, 62.1, '2026-06-15',
'2026-05-18 10:00:00+02', '2026-05-19 14:30:00+02');

-- Quote 2: Pedro Sánchez — ENVIADO
INSERT INTO quotes (id, event_id, lead_id, status, base_pvp, base_cost, bar_price, extras_pvp, extras_cost, iva_pct, total_pvp, total_cost, margin_pct, valid_until, sent_at) VALUES
('b1000001-0000-0000-0000-000000000002', 'e0000001-0000-0000-0000-000000000002', 'a1000001-0000-0000-0000-000000000003', 'sent',
704.30, 290.50, 60.00, 0.00, 0.00, 10.00, 704.30, 290.50, 58.8, '2026-06-30',
'2026-05-20 09:00:00+02');

-- Quote 3: Eventos CR — ACEPTADA
INSERT INTO quotes (id, event_id, status, base_pvp, base_cost, bar_price, extras_pvp, extras_cost, iva_pct, total_pvp, total_cost, margin_pct, valid_until, sent_at, accepted_at) VALUES
('b1000001-0000-0000-0000-000000000003', 'e0000001-0000-0000-0000-000000000003', 'accepted',
2178.00, 945.00, 240.00, 0.00, 0.00, 10.00, 2178.00, 945.00, 56.6, '2026-04-30',
'2026-04-25 10:00:00+02', '2026-04-26 16:00:00+02');

-- ═══ EVENT ORDERS (solo para aceptados/completados) ═══
INSERT INTO event_orders (id, event_id, quote_id, client_id, confirmed_price, final_price, status, tables_suggested, tables_confirmed, waiters_suggested, waiters_confirmed) VALUES
('d1000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', 4095.00, 4095.00, 'completed', 12, 12, 4, 4),
('d1000001-0000-0000-0000-000000000002', 'e0000001-0000-0000-0000-000000000003', 'b1000001-0000-0000-0000-000000000003', 'c0000001-0000-0000-0000-000000000002', 2178.00, 2178.00, 'completed', 6, 6, 3, 3);

-- ═══ PAYMENTS ═══
-- Boda María: señal (40%) + saldo (60%) = todo pagado
INSERT INTO payments (event_id, concept, amount, due_date, paid, paid_date, method, notes) VALUES
('e0000001-0000-0000-0000-000000000001', 'Señal boda María (40%)', 1638.00, '2026-05-20', true, '2026-05-19', 'transferencia', 'Transferencia BBVA'),
('e0000001-0000-0000-0000-000000000001', 'Saldo boda María (60%)', 2457.00, '2026-06-15', true, '2026-06-10', 'transferencia', 'Transferencia BBVA');

-- Boda Pedro: señal pendiente (esperando aceptación)
INSERT INTO payments (event_id, concept, amount, due_date, paid, method, notes) VALUES
('e0000001-0000-0000-0000-000000000002', 'Señal boda Pedro (40%)', 281.72, '2026-06-01', false, NULL, 'Pendiente transferencia');

-- Corporativo: señal + saldo + extra = todo pagado
INSERT INTO payments (event_id, concept, amount, due_date, paid, paid_date, method, notes) VALUES
('e0000001-0000-0000-0000-000000000003', 'Señal corporativo (40%)', 871.20, '2026-04-28', true, '2026-04-27', 'tarjeta', 'Visa ****4521'),
('e0000001-0000-0000-0000-000000000003', 'Saldo corporativo (60%)', 1306.80, '2026-05-08', true, '2026-05-07', 'transferencia', 'Transferencia Caixabank'),
('e0000001-0000-0000-0000-000000000003', 'Extra consumiciones bar', 120.00, '2026-05-15', true, '2026-05-12', 'efectivo', '');

-- ═══ INVOICES (solo para completados y pagados) ═══
INSERT INTO invoices (event_order_id, event_id, client_id, invoice_number, fiscal_name, fiscal_nif, fiscal_address, subtotal, iva_pct, iva_amount, total, extras_pvp, payments_total, balance_due, status, paid_at) VALUES
('d1000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', 'FE-2026-5066', 'María García López', 'Y1234567X', 'Calle Sierpes 42, Sevilla', 4095.00, 10.00, 409.50, 4504.50, 0.00, 4095.00, 0.00, 'paid', '2026-06-10'),
('d1000001-0000-0000-0000-000000000002', 'e0000001-0000-0000-0000-000000000003', 'c0000001-0000-0000-0000-000000000002', 'FE-2026-5067', 'Eventos CR SL', 'B9876543M', 'Avda. de la Constitución 15, Sevilla', 2178.00, 10.00, 217.80, 2395.80, 120.00, 2298.00, 97.80, 'paid', '2026-05-12');

-- ═══ GUEST FORMS (formato correcto: dietary como array) ═══
INSERT INTO guest_forms (event_id, client_name, email, guests, client_token) VALUES
('e0000001-0000-0000-0000-000000000001', 'María García López', 'maria.garcia@gmail.com',
'[{"name":"Antonio García","group_name":"Familia novia","menu_type":"adulto","dietary":[],"notes":"Padre de la novia"},{"name":"Carmen López","group_name":"Familia novia","menu_type":"adulto","dietary":["vegetariano"],"notes":"Madre de la novia"},{"name":"Javier García","group_name":"Familia novia","menu_type":"adulto","dietary":["celiaco"],"notes":"Hermano de la novia"},{"name":"Lucía García","group_name":"Familia novia","menu_type":"nino","dietary":[],"notes":"Sobrina"},{"name":"Pedro Martín","group_name":"Familia novio","menu_type":"adulto","dietary":[],"notes":"Padre del novio"},{"name":"Isabel Ruiz","group_name":"Familia novio","menu_type":"adulto","dietary":[],"notes":"Madre del novio"},{"name":"Ana Martín","group_name":"Familia novio","menu_type":"adulto","dietary":["vegano"],"notes":"Tía del novio"},{"name":"Carlos Ruiz","group_name":"Familia novio","menu_type":"nino","dietary":[],"notes":"Primo del novio"}]'::jsonb,
'a1b2c3d4-e5f6-7890-abcd-ef1234567890');

-- ═══ WAITERS ═══
INSERT INTO waiters (name, role, active) VALUES
('Antonio Morales', 'camarero_jefe', true),
('María Sevilla', 'camarera', true),
('Pedro López', 'camarero', true),
('Ana Ruiz', 'camarera', true),
('Carlos Gómez', 'barman', true);

-- ═══ VERIFICACIÓN ═══
SELECT '=== RESUMEN ===' as info;
SELECT 'leads' as t, count(*)::int as n FROM leads
UNION ALL SELECT 'events', count(*)::int FROM events
UNION ALL SELECT 'quotes', count(*)::int FROM quotes
UNION ALL SELECT 'event_orders', count(*)::int FROM event_orders
UNION ALL SELECT 'payments', count(*)::int FROM payments
UNION ALL SELECT 'invoices', count(*)::int FROM invoices
UNION ALL SELECT 'guest_forms', count(*)::int FROM guest_forms
UNION ALL SELECT 'waiters', count(*)::int FROM waiters
UNION ALL SELECT 'clients', count(*)::int FROM clients
ORDER BY t;

SELECT '=== EVENTOS ===' as info;
SELECT e.client_name, e.event_type, e.status, e.guest_count, e.total_pvp::numeric,
  (SELECT count(*)::int FROM quotes q WHERE q.event_id = e.id) as quotes,
  (SELECT count(*)::int FROM payments p WHERE p.event_id = e.id) as pagos,
  (SELECT count(*) FILTER (WHERE paid=true)::int FROM payments p WHERE p.event_id = e.id) as pagados
FROM events e ORDER BY e.event_date;

SELECT '=== LEADS ===' as info;
SELECT name, source, status, event_type FROM leads ORDER BY created_at;
