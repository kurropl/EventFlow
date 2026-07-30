-- ============================================================
-- Verificación de la migración WP-13
-- Ejecutar después de aplicar 004_wp13_coste_vivo_alertas.sql
-- ============================================================

-- 1. Verificar tablas WP-12 (creadas en esta migración)
SELECT
  CASE
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'menus')
    THEN '✅ Tabla menus existe'
    ELSE '❌ Tabla menus NO existe'
  END AS menus_check;

SELECT
  CASE
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'menu_sections')
    THEN '✅ Tabla menu_sections existe'
    ELSE '❌ Tabla menu_sections NO existe'
  END AS menu_sections_check;

SELECT
  CASE
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'menu_section_dishes')
    THEN '✅ Tabla menu_section_dishes existe'
    ELSE '❌ Tabla menu_section_dishes NO existe'
  END AS menu_section_dishes_check;

-- 2. Verificar columna margin_alert_threshold
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'business_settings'
      AND column_name = 'margin_alert_threshold'
    )
    THEN '✅ Columna margin_alert_threshold existe'
    ELSE '❌ Columna margin_alert_threshold NO existe'
  END AS threshold_check;

-- 3. Verificar tabla menu_cost_alerts
SELECT
  CASE
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'menu_cost_alerts')
    THEN '✅ Tabla menu_cost_alerts existe'
    ELSE '❌ Tabla menu_cost_alerts NO existe'
  END AS alerts_check;

-- 4. Verificar valor default del umbral
SELECT margin_alert_threshold
FROM business_settings
LIMIT 1;

-- 5. Verificar estructura de menu_cost_alerts
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'menu_cost_alerts'
ORDER BY ordinal_position;

-- 6. Verificar constraint de estados en menus
SELECT
  conname,
  pg_get_constraintdef(oid) AS constraint_def
FROM pg_constraint
WHERE conname LIKE '%menus%status%';
