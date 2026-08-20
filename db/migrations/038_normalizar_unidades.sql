-- ============================================================
-- WP-C5: Normalización de unidades de medida
-- Migración: corregir 'gr' → 'g', fijar base_unit correcto
-- según dimensión del ingrediente (masa/volumen/conteo)
-- ============================================================

-- ============================================================
-- NOTA: Criterios de corrección de base_unit
-- ============================================================
-- La migración WP-01 (001_wp01_unidades_base.sql) mapeó unidades
-- a base_unit con reglas simples (kg→g, l→ml, demás→ud).
-- Esto generó errores cuando:
--   1. 'gr' no se reconoció → se asignó base_unit='ud' (debería ser 'g')
--   2. Ingredientes de masa (lomito, cordero, bechamel) con unit='kg'
--      o 'gr' quedaron con base_unit='ud' (debería ser 'g')
--   3. Ingredientes de volumen con unit='ml' quedaron con base_unit='ud'
--      (debería ser 'ml')
--   4. La tabla ingredient_unit_conversions tiene filas g→ud para
--      ingredientes de masa (factor 1), que es incorrecto:
--      g ya es la unidad base de masa, no se convierte a ud.
--
-- Criterios aplicados aquí:
--   A) 'gr' → 'g' en ingredients.unit (alias de gramo)
--   B) Si unit IN ('kg','g','gr') → base_unit = 'g' (masa)
--   C) Si unit IN ('ml','l','L') → base_unit = 'ml' (volumen)
--   D) Si unit IN ('ud','doc') → base_unit = 'ud' (conteo)
--   E) Eliminar conversiones g→ud para masa (g es ya base_unit='g')
-- ============================================================

-- ============================================================
-- PASO 1: Normalizar 'gr' → 'g' en ingredients.unit
-- ============================================================

UPDATE ingredients
SET unit = 'g'
WHERE unit = 'gr';

-- ============================================================
-- PASO 2: Corregir base_unit según dimensión de la unidad
--
-- Regla: la unidad del ingrediente determina su dimensión:
--   - Masa (kg, g, gr) → base_unit = 'g'
--   - Volumen (ml, l, L) → base_unit = 'ml'
--   - Conteo (ud, doc) → base_unit = 'ud'
--
-- Solo corregir donde base_unit es incorrecto, no sobrescribir
-- los que ya están bien.
-- ============================================================

-- Masa: unit IN ('kg','g') y base_unit NO es 'g' → fijar a 'g'
UPDATE ingredients
SET base_unit = 'g'
WHERE unit IN ('kg', 'g')
  AND base_unit != 'g';

-- Volumen: unit IN ('ml','l','L') y base_unit NO es 'ml' → fijar a 'ml'
UPDATE ingredients
SET base_unit = 'ml'
WHERE LOWER(unit) IN ('ml', 'l')
  AND base_unit != 'ml';

-- Conteo: unit IN ('ud','doc') y base_unit NO es 'ud' → fijar a 'ud'
UPDATE ingredients
SET base_unit = 'ud'
WHERE unit IN ('ud', 'doc')
  AND base_unit != 'ud';

-- ============================================================
-- PASO 3: Asegurar que existan conversiones estándar
-- para unidades no-base (kg→g, l→ml, doc→ud)
-- que no hayan sido creadas por WP-01 o que estén rotas.
-- ============================================================

-- kg → g (factor 1000) — solo si no existe ya
INSERT INTO ingredient_unit_conversions (ingredient_id, unit_name, factor_to_base)
SELECT i.id, 'kg', 1000.0000
FROM ingredients i
WHERE i.unit = 'kg'
  AND NOT EXISTS (
    SELECT 1 FROM ingredient_unit_conversions c
    WHERE c.ingredient_id = i.id AND c.unit_name = 'kg'
  );

-- l → ml (factor 1000) — solo si no existe ya
INSERT INTO ingredient_unit_conversions (ingredient_id, unit_name, factor_to_base)
SELECT i.id, 'l', 1000.0000
FROM ingredients i
WHERE LOWER(i.unit) = 'l'
  AND NOT EXISTS (
    SELECT 1 FROM ingredient_unit_conversions c
    WHERE c.ingredient_id = i.id AND c.unit_name = 'l'
  );

-- doc → ud (factor 12) — solo si no existe ya
INSERT INTO ingredient_unit_conversions (ingredient_id, unit_name, factor_to_base)
SELECT i.id, 'doc', 12.0000
FROM ingredients i
WHERE i.unit = 'doc'
  AND NOT EXISTS (
    SELECT 1 FROM ingredient_unit_conversions c
    WHERE c.ingredient_id = i.id AND c.unit_name = 'doc'
  );

-- ============================================================
-- PASO 4: Eliminar conversiones g→ud para ingredientes de masa
--
-- Si un ingrediente tiene base_unit='g' (masa) y tiene una
-- conversión g→ud con factor 1, es un residuo del backfill
-- de WP-01 que creó conversiones para TODAS las unidades
-- ambiguas con factor 1. Para masa, g ya es la base:
-- esa conversión no tiene sentido y puede causar confusiones.
--
-- Borramos las conversiones g→ud solo para ingredientes de masa.
-- Para otros ingredientes (volumen, conteo), la conversión
-- g→ud puede no existir de todos modos.
-- ============================================================

DELETE FROM ingredient_unit_conversions
WHERE unit_name = 'ud'
  AND factor_to_base = 1.0000
  AND ingredient_id IN (
    SELECT id FROM ingredients WHERE base_unit = 'g'
  );

-- ============================================================
-- VERIFICACIÓN
-- ============================================================

-- 1. Verificar que no quedan 'gr' en la DB
DO $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT count(*) INTO v_count FROM ingredients WHERE unit = 'gr';
  IF v_count > 0 THEN
    RAISE NOTICE 'C5 WARNING: % ingredientes con unit=gr no se corrigieron', v_count;
  ELSE
    RAISE NOTICE 'C5 OK: No quedan ingredientes con unit=gr';
  END IF;
END $$;

-- 2. Verificar que no hay masa con base_unit='ud'
DO $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT count(*) INTO v_count
  FROM ingredients
  WHERE unit IN ('kg', 'g') AND base_unit = 'ud';
  IF v_count > 0 THEN
    RAISE NOTICE 'C5 WARNING: % ingredientes de masa con base_unit=ud', v_count;
  ELSE
    RAISE NOTICE 'C5 OK: No hay masa con base_unit=ud';
  END IF;
END $$;

-- 3. Verificar que no hay volumen con base_unit='ud'
DO $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT count(*) INTO v_count
  FROM ingredients
  WHERE LOWER(unit) IN ('ml', 'l') AND base_unit = 'ud';
  IF v_count > 0 THEN
    RAISE NOTICE 'C5 WARNING: % ingredientes de volumen con base_unit=ud', v_count;
  ELSE
    RAISE NOTICE 'C5 OK: No hay volumen con base_unit=ud';
  END IF;
END $$;

-- 4. Resumen de mapeo actual
SELECT
  i.unit AS unidad_original,
  i.base_unit AS base_unit,
  COUNT(*) AS ingredientes
FROM ingredients i
GROUP BY i.unit, i.base_unit
ORDER BY i.unit, i.base_unit;

-- 5. Conteo por base_unit
SELECT
  base_unit,
  COUNT(*) AS count
FROM ingredients
GROUP BY base_unit
ORDER BY base_unit;

-- 6. Conversiones g→ud que quedan (deberían ser 0 para masa)
SELECT
  i.name,
  i.unit,
  i.base_unit,
  c.unit_name,
  c.factor_to_base
FROM ingredient_unit_conversions c
JOIN ingredients i ON i.id = c.ingredient_id
WHERE c.unit_name = 'ud' AND c.factor_to_base = 1.0000
ORDER BY i.base_unit, i.name;