-- M1-packs: alinear esquema pack_templates con lo que el código espera
-- y poblar pack_template_items desde el JSONB legacy (items).

-- 1) Añadir columnas que el código referencia (si no existen)
ALTER TABLE pack_templates ADD COLUMN IF NOT EXISTS pack_type TEXT;
ALTER TABLE pack_templates ADD COLUMN IF NOT EXISTS description TEXT;

-- 2) Asignar pack_type según el nombre (mapeo 1:1)
UPDATE pack_templates SET pack_type = 'camareros' WHERE nombre ILIKE '%camarero%' AND pack_type IS NULL;
UPDATE pack_templates SET pack_type = 'alergenos' WHERE nombre ILIKE '%alerg%' AND pack_type IS NULL;
UPDATE pack_templates SET pack_type = 'supervivencia' WHERE nombre ILIKE '%superviv%' AND pack_type IS NULL;
UPDATE pack_templates SET description = nombre WHERE description IS NULL;

-- 3) Poblar pack_template_items desde el jsonb items de cada plantilla
INSERT INTO pack_template_items (template_id, name, category, quantity_per_unit, condition_type, notes)
SELECT
  t.id,
  it->>'n' AS name,
  'general' AS category,
  COALESCE((it->>'c')::int, 1) AS quantity_per_unit,
  'all' AS condition_type,
  NULL AS notes
FROM pack_templates t
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(t.items, '[]'::jsonb)) AS it
WHERE t.pack_type IS NOT NULL;

-- 3) Duplicados: si la migración ya se ejecutó, no insertar de nuevo
--    (los template_id + name ya existentes se saltan)
DELETE FROM pack_template_items a
USING pack_template_items b
WHERE a.id > b.id AND a.template_id = b.template_id AND a.name = b.name;

-- Verificación
\echo '=== pack_templates ==='
SELECT id, nombre, pack_type, description, active FROM pack_templates;
\echo '=== pack_template_items (roster) ==='
SELECT pt.nombre AS template, pt.pack_type, pti.name, pti.quantity_per_unit, pti.condition_type
FROM pack_template_items pti JOIN pack_templates pt ON pt.id = pti.template_id
ORDER BY pt.pack_type, pti.name;