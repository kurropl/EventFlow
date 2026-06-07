-- ============================================================
-- PARTE 2: DATOS REALISTAS DE DEMO
-- ============================================================

-- ═══ 3. CLIENTES ═══
INSERT INTO clients (id, name, email, phone, company, fiscal_name, fiscal_nif, fiscal_address, tags, notes) VALUES
('c0000001-0000-0000-0000-000000000001', 'María García López', 'maria.garcia@gmail.com', '622 34 56 78', NULL, 'María García López', 'Y1234567X', 'Calle Sierpes 42, Sevilla', '["boda","vip"]', 'Clienta recurrente. Boda con 120 invitados.'),
('c0000001-0000-0000-0000-000000000002', 'Carlos Rodríguez Martín', 'carlos.rm@outlook.com', '645 67 89 01', 'Eventos CR SL', 'Eventos CR SL', 'B9876543M', 'Avda. de la Constitución 15, Sevilla', '["corporativo"]', 'Empresa de eventos. Frecuencia mensual.'),
('c0000001-0000-0000-0000-000000000003', 'Ana Martínez Ruiz', 'ana.martinez@hotmail.com', '612 23 45 67', NULL, 'Ana Martínez Ruiz', 'Z8765432N', 'Calle Betis 8, Sevilla', '["comunion","familiar"]', 'Comunión de su hijo Pablo.'),
('c0000001-0000-0000-0000-000000000004', 'Pedro Sánchez Moreno', 'pedro.sanchez@gmail.com', '678 90 12 34', NULL, 'Pedro Sánchez Moreno', 'X5432109K', 'Calle Tetuán 20, Sevilla', '["boda"]', 'Boda íntima, 40 personas.'),
('c0000001-0000-0000-0000-000000000005', 'Lucía Fernández Díaz', 'lucia.fernandez@icloud.com', '634 56 78 90', NULL, 'Lucía Fernández Díaz', 'W1928374Q', 'Calle Jesús del Gran Poder 5, Sevilla', '["bautizo","familiar"]', 'Bautizo de su hija Sofía.');

-- ═══ 4. LEADS ═══
INSERT INTO leads (id, name, email, phone, source, status, event_type, guest_count, event_date, notes) VALUES
-- Leads nuevos (por captar)
('l0000001-0000-0000-0000-000000000001', 'Isabel Moreno Vega', 'isabel.moreno@gmail.com', '691 23 45 67', 'whatsapp', 'nuevo', 'boda', 100, '2026-09-15', 'Interesada en boda de verano. Preguntó por disponibilidad.'),
('l0000001-0000-0000-0000-000000000002', 'Javier Torres Blanco', 'javier.torres@outlook.com', '656 78 90 12', 'configurador', 'nuevo', 'comunion', 45, '2026-05-20', 'Comunión de su hija. Relleno formulario web.'),
('l0000001-0000-0000-0000-000000000003', 'Carmen Díaz Navarro', 'carmen.diaz@gmail.com', '643 21 09 87', 'whatsapp', 'contactado', 'bodas', 80, '2026-10-10', 'Llamada 15/05. Quiere paquete premium.'),
('l0000001-0000-0000-0000-000000000004', 'Roberto Jiménez', 'roberto.j@gmail.com', '667 89 01 23', 'manual', 'contactado', 'corporativo', 60, '2026-07-04', 'Evento empresa. Recomendado por Carlos R.'),
-- Lead presupuestado (con quote vinculado)
('l0000001-0000-0000-0000-000000000005', 'Laura Navarro Suárez', 'laura.navarro@gmail.com', '628 34 56 78', 'configurador', 'presupuestado', 'boda', 90, '2026-11-20', 'Cita 20/05. Presupuesto enviado.'),
-- Lead convertido a cliente
('l0000001-0000-0000-0000-000000000006', 'María García López', 'maria.garcia@gmail.com', '622 34 56 78', 'whatsapp', 'convertido', 'boda', 120, '2026-06-21', 'Convertida a cliente c0000001-0000-0000-0000-000000000001'),
('l0000001-0000-0000-0000-000000000007', 'Ana Martínez Ruiz', 'ana.martinez@hotmail.com', '612 23 45 67', 'configurador', 'convertido', 'comunion', 50, '2026-06-15', 'Convertida a cliente c0000001-0000-0000-0000-000000000003'),
-- Lead perdido
('l0000001-0000-0000-0000-000000000008', 'Marcos Gil Estévez', 'marcos.gil@gmail.com', '619 87 65 43', 'whatsapp', 'perdido', 'boda', 70, '2026-08-01', 'Eligió otro salón. Presupuesto demasiado ajustado.');

-- ═══ 5. EVENTOS ═══
-- Evento 1: BODA — aceptado (con quote, order, pagos, factura)
INSERT INTO events (id, client_name, client_email, client_phone, event_type, guest_count, kids_count, event_date, status, selected_items, total_pvp, total_cost, bar_hours, bar_price, iva_pct, client_id, linen_type, centerpiece, client_token) VALUES
('e0000001-0000-0000-0000-000000000001', 'María García López', 'maria.garcia@gmail.com', '622 34 56 78', 'boda', 120, 15, '2026-06-21', 'accepted',
'[
  {"item_id": "cat-jamon", "name": "Jamón ibérico 75% bellota", "category": "aperitivo-frio", "quantity": 6, "unit_price_pvp": 5.50, "unit_price_cost": 2.80, "subtotal_pvp": 33.00, "subtotal_cost": 16.80},
  {"item_id": "cat-croq", "name": "Croquetas de jamón ibérico", "category": "aperitivo-caliente", "quantity": 10, "unit_price_pvp": 2.20, "unit_price_cost": 0.70, "subtotal_pvp": 22.00, "subtotal_cost": 7.00},
  {"item_id": "cat-carrillera", "name": "Carrillera a baja temperatura con puré de patatas trufado", "category": "carne", "quantity": 80, "unit_price_pvp": 12.50, "unit_price_cost": 5.00, "subtotal_pvp": 1000.00, "subtotal_cost": 400.00},
  {"item_id": "cat-merluza", "name": "Merluza rellena de mariscos y almejas a la marinera", "category": "pescado", "quantity": 40, "unit_price_pvp": 11.50, "unit_price_cost": 4.80, "subtotal_pvp": 460.00, "subtotal_cost": 192.00},
  {"item_id": "cat-sorbete-limon", "name": "Sorbete de limón", "category": "sorbete", "quantity": 120, "unit_price_pvp": 2.50, "unit_price_cost": 0.80, "subtotal_pvp": 300.00, "subtotal_cost": 96.00},
  {"item_id": "cat-tarta", "name": "Tarta de celebración", "category": "postre", "quantity": 120, "unit_price_pvp": 5.00, "unit_price_cost": 2.00, "subtotal_pvp": 600.00, "subtotal_cost": 240.00},
  {"item_id": "cat-cava", "name": "Cava brindis", "category": "bebida", "quantity": 120, "unit_price_pvp": 3.50, "unit_price_cost": 1.20, "subtotal_pvp": 420.00, "subtotal_cost": 144.00},
  {"item_id": "cat-vino-tinto", "name": "Vino tinto Lomas del Marquez", "category": "bebida", "quantity": 120, "unit_price_pvp": 4.50, "unit_price_cost": 1.80, "subtotal_pvp": 540.00, "subtotal_cost": 216.00}
]'::jsonb,
4095.00, 1551.80, 3, 45.00, 10.00,
'c0000001-0000-0000-0000-000000000001', 'Blanco ivory', 'Rosa gardenia', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890');

-- Evento 2: COMUNIÓN — borrador (recién creado, sin quote)
INSERT INTO events (id, client_name, client_email, client_phone, event_type, guest_count, kids_count, event_date, status, selected_items, total_pvp, total_cost, bar_hours, bar_price, iva_pct, client_id, linen_type, centerpiece) VALUES
('e0000001-0000-0000-0000-000000000002', 'Ana Martínez Ruiz', 'ana.martinez@hotmail.com', '612 23 45 67', 'comunion', 50, 12, '2026-06-15', 'draft',
'[]'::jsonb,
0.00, 0.00, 0, 0.00, 10.00,
'c0000001-0000-0000-0000-000000000003', NULL, NULL);

-- Evento 3: BODA — enviado (quote enviado, esperando respuesta)
INSERT INTO events (id, client_name, client_email, client_phone, event_type, guest_count, kids_count, event_date, status, selected_items, total_pvp, total_cost, bar_hours, bar_price, iva_pct, client_id, linen_type, centerpiece) VALUES
('e0000001-0000-0000-0000-000000000003', 'Pedro Sánchez Moreno', 'pedro.sanchez@gmail.com', '678 90 12 34', 'boda', 40, 5, '2026-09-12', 'sent',
'[
  {"item_id": "cat-chacinas", "name": "Chacinas y quesos", "category": "aperitivo-frio", "quantity": 4, "unit_price_pvp": 4.20, "unit_price_cost": 2.00, "subtotal_pvp": 16.80, "subtotal_cost": 8.00},
  {"item_id": "cat-solomillo", "name": "Solomillo de vaca vieja, cremoso de patata y salsa a la pimienta negra", "category": "carne", "quantity": 25, "unit_price_pvp": 14.50, "unit_price_cost": 6.20, "subtotal_pvp": 362.50, "subtotal_cost": 155.00},
  {"item_id": "cat-bacalao", "name": "Lomo de bacalao confitado, espinacas ahumadas a la crema", "category": "pescado", "quantity": 15, "unit_price_pvp": 11.00, "unit_price_cost": 4.50, "subtotal_pvp": 165.00, "subtotal_cost": 67.50},
  {"item_id": "cat-tarta-queso", "name": "Tarta de queso", "category": "postre", "quantity": 40, "unit_price_pvp": 4.00, "unit_price_cost": 1.50, "subtotal_pvp": 160.00, "subtotal_cost": 60.00}
]'::jsonb,
704.30, 290.50, 2, 30.00, 10.00,
'c0000001-0000-0000-0000-000000000004', 'Lino natural', 'Hortensia blanca');

-- Evento 4: CORPORATIVO — completado (pagado, factura emitida)
INSERT INTO events (id, client_name, client_email, client_phone, event_type, guest_count, kids_count, event_date, status, selected_items, total_pvp, total_cost, bar_hours, bar_price, iva_pct, client_id, linen_type, centerpiece) VALUES
('e0000001-0000-0000-0000-000000000004', 'Eventos CR SL', 'carlos.rm@outlook.com', '645 67 89 01', 'corporativo', 60, 0, '2026-05-10', 'completed',
'[
  {"item_id": "cat-mariscos-estacion", "name": "Estación de mariscos", "category": "complemento", "quantity": 1, "unit_price_pvp": 175.00, "unit_price_cost": 75.00, "subtotal_pvp": 175.00, "subtotal_cost": 75.00},
  {"item_id": "cat-presa", "name": "Presa a la brasa, salsa al whisky, patatas fritas, padrón y piquillos", "category": "carne", "quantity": 60, "unit_price_pvp": 13.50, "unit_price_cost": 5.80, "subtotal_pvp": 810.00, "subtotal_cost": 348.00},
  {"item_id": "cat-arroz-mariscos", "name": "Arroz meloso de mariscos y pescados de roca", "category": "arroz", "quantity": 60, "unit_price_pvp": 9.00, "unit_price_cost": 3.80, "subtotal_pvp": 540.00, "subtotal_cost": 228.00},
  {"item_id": "cat-chocolate", "name": "Mucho chocolate", "category": "postre", "quantity": 60, "unit_price_pvp": 4.50, "unit_price_cost": 1.80, "subtotal_pvp": 270.00, "subtotal_cost": 108.00},
  {"item_id": "cat-cerveza", "name": "Cerveza con y sin", "category": "bebida", "quantity": 60, "unit_price_pvp": 2.50, "unit_price_cost": 0.80, "subtotal_pvp": 150.00, "subtotal_cost": 48.00}
]'::jsonb,
2178.00, 945.00, 4, 60.00, 10.00,
'c0000001-0000-0000-0000-000000000002', NULL, NULL);

-- Evento 5: BODA — borrador (nuevo, sin presupuesto)
INSERT INTO events (id, client_name, client_email, client_phone, event_type, guest_count, kids_count, event_date, status, selected_items, total_pvp, total_cost, bar_hours, bar_price, iva_pct, linen_type, centerpiece) VALUES
('e0000001-0000-0000-0000-000000000005', 'Lucía Fernández Díaz', 'lucia.fernandez@icloud.com', '634 56 78 90', 'bautizo', 35, 8, '2026-07-20', 'draft',
'[]'::jsonb,
0.00, 0.00, 0, 0.00, 10.00, NULL, NULL);

-- ═══ 6. QUOTES ═══
-- Quote 1: Boda María — aceptada
INSERT INTO quotes (id, event_id, lead_id, status, base_pvp, base_cost, bar_price, extras_pvp, extras_cost, iva_pct, total_pvp, total_cost, margin_pct, valid_until, sent_at, accepted_at) VALUES
('a0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', NULL, 'accepted',
3675.00, 1391.80, 135.00, 285.00, 125.00, 10.00,
4095.00, 1551.80, 62.1, '2026-06-15',
'2026-05-18 10:00:00+02', '2026-05-19 14:30:00+02');

-- Quote 2: Boda Pedro — enviada
INSERT INTO quotes (id, event_id, lead_id, status, base_pvp, base_cost, bar_price, extras_pvp, extras_cost, iva_pct, total_pvp, total_cost, margin_pct, valid_until, sent_at) VALUES
('a0000001-0000-0000-0000-000000000002', 'e0000001-0000-0000-0000-000000000003', 'l0000001-0000-0000-0000-000000000004', 'sent',
704.30, 290.50, 60.00, 0.00, 0.00, 10.00,
704.30, 290.50, 58.8, '2026-06-30',
'2026-05-20 09:00:00+02');

-- Quote 3: Boda Laura — enviada (lead presupuestado)
INSERT INTO quotes (id, event_id, lead_id, status, base_pvp, base_cost, bar_price, extras_pvp, extras_cost, iva_pct, total_pvp, total_cost, margin_pct, valid_until, sent_at) VALUES
('a0000001-0000-0000-0000-000000000003', 'e0000001-0000-0000-0000-000000000005', 'l0000001-0000-0000-0000-000000000005', 'sent',
1250.00, 520.00, 45.00, 0.00, 0.00, 10.00,
1250.00, 520.00, 58.4, '2026-06-15',
'2026-05-21 11:00:00+02');

-- Quote 4: Corporativo — aceptada
INSERT INTO quotes (id, event_id, status, base_pvp, base_cost, bar_price, extras_pvp, extras_cost, iva_pct, total_pvp, total_cost, margin_pct, valid_until, sent_at, accepted_at) VALUES
('a0000001-0000-0000-0000-000000000004', 'e0000001-0000-0000-0000-000000000004', 'accepted',
2178.00, 945.00, 240.00, 0.00, 0.00, 10.00,
2178.00, 945.00, 56.6, '2026-04-30',
'2026-04-25 10:00:00+02', '2026-04-26 16:00:00+02');

-- ═══ 7. EVENT ORDERS ═══
INSERT INTO event_orders (id, event_id, quote_id, client_id, confirmed_price, final_price, status, tables_suggested, tables_confirmed, waiters_suggested, waiters_confirmed) VALUES
('e00a0001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', 4095.00, 4095.00, 'completed', 12, 12, 4, 4),
('e00a0001-0000-0000-0000-000000000002', 'e0000001-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000004', 'c0000001-0000-0000-0000-000000000002', 2178.00, 2178.00, 'completed', 6, 6, 3, 3);

-- ═══ 8. PAYMENTS ═══
-- Pagos Boda María (señal + saldo = completado)
INSERT INTO payments (event_id, concept, amount, due_date, paid, paid_date, method, notes) VALUES
('e0000001-0000-0000-0000-000000000001', 'Señal boda (40%)', 1638.00, '2026-05-20', true, '2026-05-19', 'transferencia', 'Transferencia BBVA'),
('e0000001-0000-0000-0000-000000000001', 'Saldo boda (60%)', 2457.00, '2026-06-15', true, '2026-06-10', 'transferencia', 'Transferencia BBVA');

-- Pagos Corporativo (señal pagada, saldo pendiente)
INSERT INTO payments (event_id, concept, amount, due_date, paid, paid_date, method, notes) VALUES
('e0000001-0000-0000-0000-000000000004', 'Señal corporativo (40%)', 871.20, '2026-04-28', true, '2026-04-27', 'tarjeta', 'Visa ****4521'),
('e0000001-0000-0000-0000-000000000004', 'Saldo corporativo (60%)', 1306.80, '2026-05-08', true, '2026-05-07', 'transferencia', 'Transferencia Caixabank'),
('e0000001-0000-0000-0000-000000000004', 'Extra consumiciones bar', 120.00, '2026-05-15', true, '2026-05-12', 'efectivo', '');

-- Pago Boda Pedro (señal pendiente)
INSERT INTO payments (event_id, concept, amount, due_date, paid, method, notes) VALUES
('e0000001-0000-0000-0000-000000000003', 'Señal boda (40%)', 281.72, '2026-06-01', false, NULL, 'Pendiente transferencia');

-- ═══ 9. INVOICES ═══
INSERT INTO invoices (event_order_id, event_id, client_id, invoice_number, fiscal_name, fiscal_nif, fiscal_address, subtotal, iva_pct, iva_amount, total, extras_pvp, payments_total, balance_due, status, paid_at) VALUES
('e00a0001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', 'FE-2026-5066', 'María García López', 'Y1234567X', 'Calle Sierpes 42, Sevilla', 4095.00, 10.00, 409.50, 4504.50, 0.00, 4095.00, 0.00, 'paid', '2026-06-10'),
('e00a0001-0000-0000-0000-000000000002', 'e0000001-0000-0000-0000-000000000004', 'c0000001-0000-0000-0000-000000000002', 'FE-2026-5067', 'Eventos CR SL', 'B9876543M', 'Avda. de la Constitución 15, Sevilla', 2178.00, 10.00, 217.80, 2395.80, 120.00, 2298.00, 97.80, 'paid', '2026-05-12');

-- ═══ 10. GUEST FORMS ═══
INSERT INTO guest_forms (event_id, client_name, email, guests) VALUES
('e0000001-0000-0000-0000-000000000001', 'María García López', 'maria.garcia@gmail.com',
'[{"name":"Antonio García","dietary":"Sin restricciones","message":"Padre de la novia"},{"name":"Carmen López","dietary":"Vegetariana","message":"Madre de la novia"},{"name":"Javier García","dietary":"Sin gluten","message":"Hermano de la novia"}]'::jsonb);

-- ═══ 11. WAITERS ═══
INSERT INTO waiters (name, role, active) VALUES
('Antonio Morales', 'camarero_jefe', true),
('María Sevilla', 'camarera', true),
('Pedro López', 'camarero', true),
('Ana Ruiz', 'camarera', true),
('Carlos Gómez', 'barman', true);

-- ═══ VERIFICAR DATOS ═══
SELECT 'clients' as tabla, count(*)::int as registros FROM clients
UNION ALL SELECT 'leads', count(*)::int FROM leads
UNION ALL SELECT 'events', count(*)::int FROM events
UNION ALL SELECT 'quotes', count(*)::int FROM quotes
UNION ALL SELECT 'event_orders', count(*)::int FROM event_orders
UNION ALL SELECT 'payments', count(*)::int FROM payments
UNION ALL SELECT 'invoices', count(*)::int FROM invoices
UNION ALL SELECT 'guest_forms', count(*)::int FROM guest_forms
UNION ALL SELECT 'waiters', count(*)::int FROM waiters
UNION ALL SELECT 'catalog_items', count(*)::int FROM catalog_items WHERE active = true
ORDER BY tabla;
