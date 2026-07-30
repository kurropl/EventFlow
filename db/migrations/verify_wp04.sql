-- ============================================================
-- Verificación de la migración WP-04
-- Ejecutar después de aplicar 001_wp04_domain_events.sql
-- ============================================================

-- 1. Verificar que la tabla domain_events fue creada
SELECT 
  CASE 
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'domain_events') 
    THEN '✅ Tabla domain_events existe'
    ELSE '❌ Tabla domain_events NO existe'
  END AS domain_events_check;

-- 2. Verificar que el constraint de estados incluye los nuevos
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'events_status_check'
      AND pg_get_constraintdef(oid) LIKE '%en_preparacion%'
    ) 
    THEN '✅ Constraint events_status_check incluye en_preparacion'
    ELSE '❌ Constraint events_status_check NO incluye en_preparacion'
  END AS constraint_check;

-- 3. Verificar que los nuevos estados son válidos
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'events_status_check'
      AND pg_get_constraintdef(oid) LIKE '%cerrado_operativo%'
      AND pg_get_constraintdef(oid) LIKE '%cerrado_contable%'
    ) 
    THEN '✅ Todos los nuevos estados están en el constraint'
    ELSE '❌ Faltan nuevos estados en el constraint'
  END AS all_states_check;

-- 4. Listar todos los estados válidos (debería mostrar los nuevos)
SELECT 
  unnest(ARRAY[
    'nuevo', 'propuesta_enviada', 'confirmado', 'cancelado', 'en_curso', 'completado',
    'en_preparacion', 'cerrado_operativo', 'cerrado_contable'
  ]) AS estado_valido;

-- 5. Verificar que la tabla domain_events tiene las columnas correctas
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'domain_events'
ORDER BY ordinal_position;