-- Seed de kitchen_zones (9 zonas de cocina) — idempotente
INSERT INTO kitchen_zones (nombre, icon, orden)
SELECT * FROM (VALUES
  ('aperitivos', 'wine', 1),
  ('frio', 'snowflake', 2),
  ('caliente', 'flame', 3),
  ('frito', 'fryingPan', 4),
  ('entrante', 'forkKnife', 5),
  ('primero', 'bowlSteam', 6),
  ('segundo', 'forkKnife', 7),
  ('postre', 'iceCream', 8),
  ('recena', 'moon', 9)
) AS v(nombre, icon, orden)
WHERE NOT EXISTS (SELECT 1 FROM kitchen_zones);
