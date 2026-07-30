-- ============================================================
-- Verificación de Migración WP-15: Plantillas automáticas por venue
-- ============================================================

-- 1. Verificar que la columna event_templates existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_settings' AND column_name = 'event_templates'
  ) THEN
    RAISE EXCEPTION 'FAIL: Columna event_templates no existe en business_settings';
  END IF;
  RAISE NOTICE 'OK: Columna event_templates existe';
END $$;

-- 2. Verificar que el JSON tiene las claves requeridas
DO $$
DECLARE
  templates JSONB;
BEGIN
  SELECT event_templates INTO templates FROM business_settings LIMIT 1;

  IF templates IS NULL THEN
    RAISE EXCEPTION 'FAIL: event_templates es NULL';
  END IF;

  IF NOT (templates ? 'externo') THEN
    RAISE EXCEPTION 'FAIL: event_templates no contiene clave "externo"';
  END IF;

  IF NOT (templates ? 'benitez') THEN
    RAISE EXCEPTION 'FAIL: event_templates no contiene clave "benitez"';
  END IF;

  RAISE NOTICE 'OK: event_templates contiene claves externo y benitez';
END $$;

-- 3. Verificar estructura de plantilla externo
DO $$
DECLARE
  externo JSONB;
BEGIN
  SELECT event_templates->'externo' INTO externo FROM business_settings LIMIT 1;

  IF NOT (externo ? 'logistics') THEN
    RAISE WARNING 'WARN: Plantilla externo no tiene logistics';
  END IF;

  IF NOT (externo ? 'timing') THEN
    RAISE WARNING 'WARN: Plantilla externo no tiene timing';
  END IF;

  IF NOT (externo ? 'appcc_center') THEN
    RAISE WARNING 'WARN: Plantilla externo no tiene appcc_center';
  END IF;

  RAISE NOTICE 'OK: Estructura de plantilla externo verificada';
END $$;

-- 4. Verificar estructura de plantilla benitez
DO $$
DECLARE
  benitez JSONB;
BEGIN
  SELECT event_templates->'benitez' INTO benitez FROM business_settings LIMIT 1;

  IF NOT (benitez ? 'checklist') THEN
    RAISE WARNING 'WARN: Plantilla benitez no tiene checklist';
  END IF;

  IF NOT (benitez ? 'table_map') THEN
    RAISE WARNING 'WARN: Plantilla benitez no tiene table_map';
  END IF;

  RAISE NOTICE 'OK: Estructura de plantilla benitez verificada';
END $$;

-- 5. Resumen
SELECT
  'WP-15 Migration Verification Complete' as status,
  event_templates->'externo'->'logistics'->0->>'title' as sample_externo_logistics,
  event_templates->'benitez'->'checklist'->0->>'title' as sample_benitez_checklist
FROM business_settings
LIMIT 1;
