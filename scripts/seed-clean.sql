-- ============================================================
-- EventFlow — Seed de datos de prueba de calidad
-- Limpia + inserta datos para probar todos los flujos
-- ============================================================

-- Limpiar datos existentes (orden inverso por FK)
DELETE FROM table_plans;
DELETE FROM floor_plans;
DELETE FROM webhook_logs;
DELETE FROM cost_desglose;
DELETE FROM automation_logs;
DELETE FROM automation_rules;
DELETE FROM guests;
DELETE FROM payments;
DELETE FROM invoices;
DELETE FROM event_menu_items;
DELETE FROM invoices;
DELETE FROM event_orders;
DELETE FROM quotes;
DELETE FROM leads;
DELETE FROM appointments;
DELETE FROM events;
DELETE FROM clients;
DELETE FROM providers;
DELETE FROM waiters;
DELETE FROM admins WHERE email != 'admin@eventflow.app';
