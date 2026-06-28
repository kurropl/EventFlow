-- ============================================================
-- EventFlow — Ejemplo controlado para verificación E2E del proceso
--   psql "$DATABASE_URL" -f scripts/verify-ejemplo-e2e.sql
--
-- Escenario determinista (para poder ASERTAR cifras exactas):
--   - Boda, 120 adultos, 0 niños, servicio = menú
--     ⇒ mesas = ceil(120/10) = 12 ; camareros = ceil(120/10)+floor(120/25) = 16
--   - 1 plato de catálogo "Solomillo VERIFY" con receta (system B):
--       · Solomillo (carne)  200 g/ración · 0,0400 €/g  ⇒ 8,00 €/ración
--       · Sal fina           2 g/ración   · 0,0010 €/g  ⇒ 0,002 €/ración (despreciable)
--     Para 120 raciones ⇒ Solomillo 24.000 g, Sal 240 g
--     Coste teórico ingredientes ≈ 120 × (8,00 + 0,002) = 960,24 €
--   - PVP del plato = 25 €/ración ⇒ total_pvp = 3000 € ; señal 40% = 1200 € ; saldo 60% = 1800 €
-- ============================================================

BEGIN;

-- Limpieza idempotente del ejemplo (por si se re-ejecuta).
-- Orden por dependencias: invoices (RESTRICT) → resto → events.
DELETE FROM invoices            WHERE event_id  = '55555555-5555-5555-5555-555555555555';
DELETE FROM event_shopping_items WHERE event_id = '55555555-5555-5555-5555-555555555555';
DELETE FROM payments            WHERE event_id  = '55555555-5555-5555-5555-555555555555';
DELETE FROM staffing_lines      WHERE event_id  = '55555555-5555-5555-5555-555555555555';
DELETE FROM event_orders        WHERE event_id  = '55555555-5555-5555-5555-555555555555';
DELETE FROM events  WHERE client_email = 'verify@eventflow.test';
DELETE FROM clients WHERE email = 'verify@eventflow.test';
DELETE FROM admins  WHERE email = 'chef@verify.test';  -- usuario RBAC de prueba
-- Import de recetas de prueba (FR-C10)
DELETE FROM recipe_items WHERE catalog_item_id IN (SELECT id FROM catalog_items WHERE name = 'Paella VERIFY');
DELETE FROM catalog_items WHERE name = 'Paella VERIFY';
DELETE FROM ingredients WHERE name IN ('Arroz VERIFY', 'Azafran VERIFY');
-- Operativos (rama 010): proveedores/trabajadores de prueba (cascada borra sus deudas/pagos)
DELETE FROM providers WHERE name = 'Prov VERIFY';
DELETE FROM workers   WHERE name = 'Worker VERIFY';
DELETE FROM recipe_items WHERE catalog_item_id IN (SELECT id FROM catalog_items WHERE name = 'Solomillo VERIFY');
DELETE FROM catalog_items WHERE name = 'Solomillo VERIFY';
DELETE FROM ingredients WHERE name IN ('Solomillo VERIFY', 'Sal fina VERIFY');

-- Ingredientes (coste por unidad base; el trigger sincroniza las 3 columnas de coste)
INSERT INTO ingredients (id, name, unit, unit_cost, quantity)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Solomillo VERIFY', 'g', 0.0400, 100000),
  ('22222222-2222-2222-2222-222222222222', 'Sal fina VERIFY',  'g', 0.0010, 100000);

-- Plato de catálogo con su JSONB (system A) Y receta (system B)
INSERT INTO catalog_items (id, name, category, pvp, cost, ingredients)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  'Solomillo VERIFY', 'carne', 25.00, 8.00,
  '[{"name":"Solomillo VERIFY","grams":200},{"name":"Sal fina VERIFY","grams":2}]'::jsonb
);

INSERT INTO recipe_items (catalog_item_id, ingredient_id, quantity)
VALUES
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 200),
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 2);

-- Cliente
INSERT INTO clients (id, name, email, phone)
VALUES ('44444444-4444-4444-4444-444444444444', 'Cliente VERIFY', 'verify@eventflow.test', '600000000');

-- Evento (draft), 120 adultos, menú.
-- total_cost = 0: sin escandallo todavía no hay coste (R2/Opción B); lo fija
-- recalcEventCost al aceptar (generateEscandallo -> 960.00 vía recipe_items).
INSERT INTO events (
  id, client_id, client_name, client_email, client_phone, event_type,
  guest_count, kids_count, event_date, status, service_type, selected_items,
  total_pvp, total_cost, iva_pct
) VALUES (
  '55555555-5555-5555-5555-555555555555',
  '44444444-4444-4444-4444-444444444444',
  'Cliente VERIFY', 'verify@eventflow.test', '600000000', 'boda',
  120, 0, (now() + interval '60 days')::date, 'draft', 'menu',
  '[{"name":"Solomillo VERIFY","quantity":120,"pvp":25,"cost":8}]'::jsonb,
  3000.00, 0.00, 10
);

-- Quote en 'sent' (listo para aceptar vía API)
INSERT INTO quotes (
  id, event_id, status, items, base_pvp, base_cost, total_pvp, total_cost, iva_pct
) VALUES (
  '66666666-6666-6666-6666-666666666666',
  '55555555-5555-5555-5555-555555555555',
  'sent',
  '[{"name":"Solomillo VERIFY","quantity":120,"pvp":25,"cost":8}]'::jsonb,
  3000.00, 960.00, 3000.00, 960.00, 10
);

UPDATE events SET quote_id = '66666666-6666-6666-6666-666666666666'
WHERE id = '55555555-5555-5555-5555-555555555555';

COMMIT;

SELECT 'seed OK' AS status,
  (SELECT count(*) FROM ingredients WHERE name LIKE '%VERIFY%') AS ingredientes,
  (SELECT count(*) FROM recipe_items WHERE catalog_item_id = '33333333-3333-3333-3333-333333333333') AS receta_lineas;
