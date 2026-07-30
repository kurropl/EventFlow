-- ============================================================
-- WP-01: Unidades Base y Conversiones
-- Migración: añadir base_unit + tabla ingredient_unit_conversions
-- + columna qty_base en recipe_items + backfill de datos
-- ============================================================

-- 1. Añadir base_unit a ingredients
ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS base_unit TEXT NOT NULL DEFAULT 'ud'
  CHECK (base_unit IN ('g', 'ml', 'ud'));

COMMENT ON COLUMN ingredients.base_unit IS 'Unidad base del ingrediente: g (masa), ml (volumen), ud (conteo). WP-01.';

-- 2. Crear tabla de conversiones por ingrediente
CREATE TABLE IF NOT EXISTS ingredient_unit_conversions (
  id              SERIAL PRIMARY KEY,
  ingredient_id   UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  unit_name       TEXT NOT NULL,
  factor_to_base  NUMERIC(14,4) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ingredient_id, unit_name)
);

CREATE INDEX IF NOT EXISTS idx_iuc_ingredient ON ingredient_unit_conversions(ingredient_id);
ALTER TABLE ingredient_unit_conversions DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE ingredient_unit_conversions IS 'Conversiones de unidades por ingrediente específico. WP-01.';

-- Trigger para updated_at
DROP TRIGGER IF EXISTS trg_iuc_updated ON ingredient_unit_conversions;
CREATE TRIGGER trg_iuc_updated BEFORE UPDATE ON ingredient_unit_conversions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. Añadir qty_base a recipe_items (cantidad en unidad base del ingrediente)
ALTER TABLE recipe_items
  ADD COLUMN IF NOT EXISTS qty_base NUMERIC(14,4);

COMMENT ON COLUMN recipe_items.qty_base IS 'Cantidad en unidad base del ingrediente (g, ml o ud). Cache calculada. WP-01.';

-- ============================================================
-- BACKFILL: Mapear unidades existentes → base_unit + conversiones
-- ============================================================

-- 4. Backfill base_unit desde la columna unit existente
-- Regla: kg→g, l→ml, demás→ud (para unidades como 'caja', 'botella', etc.)
UPDATE ingredients
SET base_unit = CASE
  WHEN unit IN ('kg', 'g') THEN 'g'
  WHEN unit IN ('l', 'L', 'ml') THEN 'ml'
  ELSE 'ud'  -- caja, botella, doc, ud, etc.
END
WHERE base_unit = 'ud';  -- Solo actualizar los que tienen el default

-- 5. Crear conversiones estándar para unidades comunes
-- kg → g (factor 1000)
INSERT INTO ingredient_unit_conversions (ingredient_id, unit_name, factor_to_base)
SELECT i.id, 'kg', 1000.0000
FROM ingredients i
WHERE i.unit = 'kg'
  AND NOT EXISTS (
    SELECT 1 FROM ingredient_unit_conversions c
    WHERE c.ingredient_id = i.id AND c.unit_name = 'kg'
  );

-- l → ml (factor 1000)
INSERT INTO ingredient_unit_conversions (ingredient_id, unit_name, factor_to_base)
SELECT i.id, 'l', 1000.0000
FROM ingredients i
WHERE LOWER(i.unit) = 'l'
  AND NOT EXISTS (
    SELECT 1 FROM ingredient_unit_conversions c
    WHERE c.ingredient_id = i.id AND c.unit_name = 'l'
  );

-- doc → ud (factor 12)
INSERT INTO ingredient_unit_conversions (ingredient_id, unit_name, factor_to_base)
SELECT i.id, 'doc', 12.0000
FROM ingredients i
WHERE i.unit = 'doc'
  AND NOT EXISTS (
    SELECT 1 FROM ingredient_unit_conversions c
    WHERE c.ingredient_id = i.id AND c.unit_name = 'doc'
  );

-- Unidades ambiguas (caja, botella, etc.) → crear conversión factor 1
-- y marcar en el informe para revisión humana
INSERT INTO ingredient_unit_conversions (ingredient_id, unit_name, factor_to_base)
SELECT i.id, i.unit, 1.0000
FROM ingredients i
WHERE i.unit NOT IN ('kg', 'g', 'l', 'ml', 'ud', 'doc')
  AND i.unit IS NOT NULL
  AND i.unit != ''
  AND NOT EXISTS (
    SELECT 1 FROM ingredient_unit_conversions c
    WHERE c.ingredient_id = i.id AND c.unit_name = i.unit
  );

-- 6. Backfill qty_base en recipe_items
-- qty_base = quantity * factor_to_base (si existe conversión), sino quantity
UPDATE recipe_items ri
SET qty_base = ri.quantity * COALESCE(
  (SELECT c.factor_to_base
   FROM ingredient_unit_conversions c
   WHERE c.ingredient_id = ri.ingredient_id
     AND c.unit_name = (
       SELECT i.unit FROM ingredients i WHERE i.id = ri.ingredient_id
     )
   LIMIT 1),
  1.0
)
WHERE ri.qty_base IS NULL;

-- Para ingredientes sin conversión explícita (ya están en base), qty_base = quantity
UPDATE recipe_items ri
SET qty_base = ri.quantity
WHERE ri.qty_base IS NULL;

-- ============================================================
-- VERIFICACIÓN: Script de comprobación
-- ============================================================

-- Verificar que todos los ingredientes tienen base_unit
DO $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT count(*) INTO v_count FROM ingredients WHERE base_unit IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'WP-01 ERROR: % ingredientes sin base_unit', v_count;
  END IF;
  RAISE NOTICE 'WP-01 OK: Todos los ingredientes tienen base_unit';
END $$;

-- Verificar que todos los recipe_items tienen qty_base
DO $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT count(*) INTO v_count FROM recipe_items WHERE qty_base IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'WP-01 ERROR: % recipe_items sin qty_base', v_count;
  END IF;
  RAISE NOTICE 'WP-01 OK: Todos los recipe_items tienen qty_base';
END $$;

-- Resumen de mapeo
SELECT
  i.unit AS unidad_original,
  i.base_unit AS base_unit_asignada,
  COUNT(*) AS ingredientes,
  COUNT(c.id) AS conversiones_creadas
FROM ingredients i
LEFT JOIN ingredient_unit_conversions c ON c.ingredient_id = i.id
GROUP BY i.unit, i.base_unit
ORDER BY i.unit;
