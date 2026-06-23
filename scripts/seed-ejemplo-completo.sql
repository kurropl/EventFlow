-- ============================================================
-- SEED: Ejemplo completo de Alboroto - Boda 23/08/2026
-- ============================================================
-- Este script crea un evento de ejemplo con:
--   - Cliente y presupuesto
--   - Evento con datos completos
--   - Menú con 3 pases
--   - Invitados (120, repartidos en mesas)
--   - Escandallo de ejemplo
--   - Personal (camareros, cocina)
--   - Briefing ya generado
-- ============================================================
-- Ejecutar: psql -U postgres -d eventflow -f seed_ejemplo.sql
-- ============================================================

BEGIN;

-- 1. LEAD (cliente potencial)
INSERT INTO leads (id, name, email, phone, source, notes, created_at)
VALUES (
  'd0000000-0000-0000-0000-000000000001',
  'Maria Sánchez',
  'maria@example.com',
  '+34600111222',
  'instagram',
  'Boda 120 invitados, agosto 2026',
  now()
);

-- 2. EVENTO (presupuestado)
INSERT INTO events (id, lead_id, client_name, email, phone, event_type, event_date, guest_count, kids_count, status, client_token, event_type_label, notes, created_at)
VALUES (
  'e0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000001',
  'Maria Sánchez',
  'maria@example.com',
  '+34600111222',
  'Boda',
  '2026-08-23',
  120,
  8,
  'presupuestado',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.cliente-ejemplo-seed',
  'Boda de día completa',
  'Evento de ejemplo para demostración del flujo completo',
  now()
);

-- 3. QUOTE (presupuesto)
INSERT INTO quotes (id, event_id, status, total, deposit_pct, deposit_amount, deposit_paid, notes, created_at)
VALUES (
  'q0000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000001',
  'draft',
  8500.00,
  40,
  3400.00,
  false,
  'Presupuesto para boda 120 invitados con menú completo',
  now()
);

-- 4. MENÚ (event_menu_items - 3 pases)
INSERT INTO event_menu_items (id, event_id, name, category, quantity, notes, created_at)
VALUES
  ('m1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Salmorejo con jamón', 'entrante', 120, 'Servir frío en cuenco de barro', now()),
  ('m2000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'Solomillo al Pedro Ximénez', 'principal', 120, 'Acompañado de patatas panadera', now()),
  ('m3000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'Tarta de queso con caramelo', 'postre', 120, 'Con base de galleta', now());

-- 5. ESCANDALLO (receta básica - salmorejo)
INSERT INTO recipes (id, name, description, servings, active, published, created_at)
VALUES ('r0000000-0000-0000-0000-000000000001', 'Salmorejo', 'Receta de 10 raciones', 10, true, true, now());

INSERT INTO recipe_items (id, recipe_id, ingredient_name, ingredient_id, quantity, unit, notes, created_at)
VALUES
  ('ri000001', 'r0000000-0000-0000-0000-000000000001', 'Tomate', 'ing-001', 1000, 'g', 'Tomate pera maduro', now()),
  ('ri000002', 'r0000000-0000-0000-0000-000000000001', 'Pan', 'ing-002', 200, 'g', 'Pan del día anterior', now()),
  ('ri000003', 'r0000000-0000-0000-0000-000000000001', 'Aceite de oliva', 'ing-003', 100, 'ml', 'Virgen extra', now()),
  ('ri000004', 'r0000000-0000-0000-0000-000000000001', 'Ajo', 'ing-004', 20, 'g', 'Dientes de ajo', now());

-- 6. INVITADOS (guest_forms - tabla de ejemplo con los 120 invitados)
INSERT INTO guest_forms (id, event_id, client_name, email, guests, submitted_at, created_at)
VALUES (
  'gf0000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000001',
  'Maria Sánchez',
  'maria@example.com',
  jsonb_build_array(
    jsonb_build_object('name', 'Juan', 'group_name', 'Mesa 1 - Familia novia', 'menu_type', 'adulto', 'dietary', ARRAY[]),
    jsonb_build_object('name', 'Ana', 'group_name', 'Mesa 1 - Familia novia', 'menu_type', 'adulto', 'dietary', ARRAY['celiaco']),
    jsonb_build_object('name', 'Carlos', 'group_name', 'Mesa 2 - Familia novio', 'menu_type', 'nino', 'dietary', ARRAY[]),
    jsonb_build_object('name', 'Marta', 'group_name', 'Mesa 2 - Familia novio', 'menu_type', 'adulto', 'dietary', ARRAY['sin_lactosa']),
    jsonb_build_object('name', 'Luis', 'group_name', 'Mesa 3 - Amigos', 'menu_type', 'adulto', 'dietary', ARRAY[]),
    jsonb_build_object('name', 'Sofia', 'group_name', 'Mesa 3 - Amigos', 'menu_type', 'adulto', 'dietary', ARRAY[])
  ),
  now(),
  now()
);

-- 7. BRIEFING (autogenerado - salmorejo para los camareros)
INSERT INTO event_briefings (id, event_id, content, status, created_at, version)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000001',
  jsonb_build_object(
    'event', jsonb_build_object(
      'name', 'Boda Maria',
      'date', '2026-08-23',
      'time', '13:00',
      'location', 'Finca Alboroto - Salón principal'
    ),
    'menu', jsonb_build_array(
      jsonb_build_object('pase', 1, 'plato', 'Salmorejo', 'notas', 'Servir frío EN cuenco de barro'),
      jsonb_build_object('pase', 2, 'plato', 'Solomillo', 'notas', 'A punto, no pasarse'),
      jsonb_build_object('pase', 3, 'plato', 'Tarta queso', 'notas', 'Caramelo aparte')
    ),
    'staff', jsonb_build_array(
      jsonb_build_object('zona', 'A', 'camarero', 'Pepe', 'tipo', 'camarero'),
      jsonb_build_object('zona', 'A', 'camarero', 'Maria', 'tipo', 'camarero'),
      jsonb_build_object('zona', 'B', 'camarero', 'Luis', 'tipo', 'camarero'),
      jsonb_build_object('zona', 'C', 'camarero', 'Ana', 'tipo', 'camarero')
    ),
    'timeline', jsonb_build_array(
      jsonb_build_object('hora', '07:00', 'tarea', 'Llegada y montaje'),
      jsonb_build_object('hora', '08:00', 'tarea', 'Colocación mesas'),
      jsonb_build_object('hora', '09:00', 'tarea', 'Preparación cocina'),
      jsonb_build_object('hora', '10:30', 'tarea', 'Montaje buffet'),
      jsonb_build_object('hora', '12:00', 'tarea', 'Apertura puertas'),
      jsonb_build_object('hora', '13:00', 'tarea', 'Servicio'),
      jsonb_build_object('hora', '16:00', 'tarea', 'Recogida'),
      jsonb_build_object('hora', '18:00', 'tarea', 'Cierre')
    ),
    'alergenos', jsonb_build_object(
      'salmorejo', ARRAY['gluten (pan)'],
      'solomillo', ARRAY[],
      'tarta', ARRAY['lactosa']
    ),
    'mesas', jsonb_build_object(
      'total', 12,
      'invitados_por_mesa', 10,
      'tipo_mantel', 'blanco',
      'centro_mesa', 'floral'
    )
  ),
  'draft',
  now(),
  1
);

-- 8. CREAR MENÚS (catalog_items - 3 platos)
INSERT INTO catalog_items (id, name, description, category, price, allergens, created_at)
VALUES
  ('cat-001', 'Salmorejo con jamón', 'Entrante frío con jamón ibérico', 'entrante', 12.50, ARRAY['gluten'], now()),
  ('cat-002', 'Solomillo al PX', 'Carne de cerdo ibérico al Pedro Ximénez', 'principal', 22.00, ARRAY[], now()),
  ('cat-003', 'Tarta de queso', 'Postre cremoso con caramelo', 'postre', 8.50, ARRAY['lactosa'], now());

-- 9. PAGOS (señal de ejemplo)
INSERT INTO payments (id, event_id, amount, method, concept, paid, created_at)
VALUES ('p0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 3400.00, 'transferencia', 'Señal presupuesto 40%', true, now());

-- 10. STAFFING (asignacion basica)
INSERT INTO staffing_lines (id, event_id, role, slots_needed, status, created_at)
VALUES
  ('s0000001', 'e0000000-0000-0000-0000-000000000001', 'camarero', 8, 'open', now()),
  ('s0000002', 'e0000000-0000-0000-0000-000000000001', 'cocinero', 3, 'open', now()),
  ('s0000003', 'e0000000-0000-0000-0000-000000000001', 'jefe_sala', 1, 'open', now());

-- 11. ESCANDALLO REAL (event_shopping_items)
INSERT INTO event_shopping_items (id, event_id, ingredient_id, recipe_item_id, ingredient_name, theoretical_qty, unit, estimated_cost, actual_quantity, actual_cost_total, frozen, created_at)
VALUES
  ('esi-001', 'e0000000-0000-0000-0000-000000000001', 'ing-001', 'ri000001', 'Tomate', 12000, 12000, 24.00, 11000, 22.00, false, now()),
  ('esi-002', 'e0000000-0000-0000-0000-000000000001', 'ing-002', 'ri000002', 'Pan', 2400, 2400, 4.80, 2500, 5.00, false, now()),
  ('esi-003', 'e0000000-0000-0000-0000-000000000001', 'ing-003', 'ri000003', 'Aceite oliva', 1200, 1200, 12.00, 1100, 11.00, false, now()),
  ('esi-004', 'e0000000-0000-0000-0000-000000000001', 'ing-004', 'ri000004', 'Ajo', 240, 240, 1.20, 250, 1.25, false, now());

-- 12. COSTES REALES (ingredientes)
INSERT INTO ingredients (id, name, current_price, unit, category, created_at)
VALUES
  ('ing-001', 'Tomate pera', 2.00, 'kg', 'verdura', now()),
  ('ing-002', 'Pan', 2.00, 'kg', 'panaderia', now()),
  ('ing-003', 'Aceite de oliva virgen extra', 10.00, 'l', 'aceite', now()),
  ('ing-004', 'Ajo', 5.00, 'kg', 'verdura', now());

-- 13. EVENTO TAMBIEN CON DATOS DE MESA Y OCUPACION
UPDATE events SET
  linen_type = 'blanco',
  centerpiece = 'floral',
  total_tables = 12,
  total_capacity = 120
WHERE id = 'e0000000-0000-0000-0000-000000000001';

COMMIT;
