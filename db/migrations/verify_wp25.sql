-- ============================================================
-- Verificación WP-25: Infraestructura del Portal del Cliente
-- Ejecutar después de 007_wp25_portal_infra.sql
-- ============================================================

-- 1. Verificar tablas creadas
DO $$
BEGIN
  -- client_portals
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_portals') THEN
    RAISE EXCEPTION 'FAIL: client_portals no existe';
  END IF;
  RAISE NOTICE 'OK: client_portals existe';

  -- portal_magic_links
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'portal_magic_links') THEN
    RAISE EXCEPTION 'FAIL: portal_magic_links no existe';
  END IF;
  RAISE NOTICE 'OK: portal_magic_links existe';
END $$;

-- 2. Verificar columnas en client_portals
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'client_portals'
ORDER BY ordinal_position;

-- 3. Verificar columnas en portal_magic_links
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'portal_magic_links'
ORDER BY ordinal_position;

-- 4. Verificar constraints
SELECT
  conname,
  contype,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid IN (
  'client_portals'::regclass,
  'portal_magic_links'::regclass
);

-- 5. Verificar índices
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('client_portals', 'portal_magic_links');

-- 6. Verificar triggers
SELECT
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('client_portals', 'portal_magic_links');

-- 7. Verificar que no hay duplicates de event_id
DO $$
BEGIN
  IF EXISTS (
    SELECT event_id, COUNT(*) 
    FROM client_portals 
    GROUP BY event_id 
    HAVING COUNT(*) > 1
  ) THEN
    RAISE WARNING 'Hay portales duplicados por event_id';
  ELSE
    RAISE NOTICE 'OK: No hay portales duplicados por event_id';
  END IF;
END $$;

-- 8. Resumen de datos (si existen)
SELECT
  (SELECT COUNT(*) FROM client_portals) as total_portals,
  (SELECT COUNT(*) FROM client_portals WHERE status = 'activo') as activos,
  (SELECT COUNT(*) FROM client_portals WHERE status = 'congelado') as congelados,
  (SELECT COUNT(*) FROM portal_magic_links) as total_magic_links,
  (SELECT COUNT(*) FROM portal_magic_links WHERE used_at IS NULL AND expires_at > now()) as magic_links_activos;
