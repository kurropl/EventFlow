-- ============================================================
-- Verificación de Migración WP-18: Cierre Operativo
-- ============================================================

-- 1. Verificar que la tabla fue creada
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'event_closure_checklists') THEN
    RAISE EXCEPTION 'FAIL: Tabla event_closure_checklists no existe';
  END IF;
  RAISE NOTICE 'OK: Tabla event_closure_checklists creada';
END $$;

-- 2. Verificar columnas principales
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'event_closure_checklists'
ORDER BY ordinal_position;

-- 3. Verificar que el constraint de estados incluye cerrado_operativo
SELECT 
  conname,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conname = 'events_status_check'
AND conrelid = 'events'::regclass;

-- 4. Verificar que el trigger de updated_at existe
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'event_closure_checklists';

-- 5. Contar tablas (debería haber 1 más que antes)
SELECT COUNT(*) as total_tables 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE';

-- 6. Verificar que se puede insertar un registro de prueba
-- (Esto fallará si hay problemas de FK o constraints)
INSERT INTO event_closure_checklists (event_id)
SELECT id FROM events LIMIT 1
ON CONFLICT (event_id) DO NOTHING;

-- 7. Verificar el registro insertado
SELECT 
  id,
  event_id,
  logistics_returned,
  waste_recorded,
  hours_validated,
  appcc_resolved,
  created_at
FROM event_closure_checklists
LIMIT 1;

-- 8. Limpiar registro de prueba (opcional, comentar si se quiere conservar)
-- DELETE FROM event_closure_checklists WHERE event_id IN (SELECT id FROM events LIMIT 1);

RAISE NOTICE 'Verificación WP-18 completada';
