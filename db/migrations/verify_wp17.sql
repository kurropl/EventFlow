-- ============================================================
-- Verificación WP-17 — Planificación de Personal y Turnos
-- ============================================================

-- 1. Verificar que offer_token existe en staffing_offers
SELECT 
  CASE 
    WHEN EXISTS(
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'staffing_offers' AND column_name = 'offer_token'
    ) THEN '✓ offer_token existe'
    ELSE '✗ offer_token NO existe'
  END AS verificacion;

-- 2. Verificar que worker_hours existe
SELECT 
  CASE 
    WHEN EXISTS(
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'worker_hours'
    ) THEN '✓ worker_hours existe'
    ELSE '✗ worker_hours NO existe'
  END AS verificacion;

-- 3. Verificar estructura de worker_hours
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'worker_hours'
ORDER BY ordinal_position;

-- 4. Verificar índices únicos
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'staffing_offers' AND indexname LIKE '%token%';

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'worker_hours' AND indexname LIKE '%unique%';

-- 5. Contar registros existentes
SELECT 
  'staffing_offers' as tabla, COUNT(*) as total,
  COUNT(offer_token) as con_token
FROM staffing_offers
UNION ALL
SELECT 
  'worker_hours' as tabla, COUNT(*) as total,
  0 as con_token
FROM worker_hours;
