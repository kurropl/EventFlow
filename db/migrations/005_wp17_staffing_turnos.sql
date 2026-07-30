-- ============================================================
-- WP-17 — Planificación de Personal y Turnos
-- Migración: Añadir offer_token + tabla worker_hours
-- ============================================================
-- Esta migración es IDEMPOTENTE: puede ejecutarse múltiples veces sin error.

-- 1. Añadir offer_token a staffing_offers para confirmación por enlace público
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'staffing_offers' AND column_name = 'offer_token'
  ) THEN
    ALTER TABLE staffing_offers ADD COLUMN offer_token TEXT;
  END IF;
END $$;

-- Crear índice único para offer_token (permite NULL pero los valores deben ser únicos)
CREATE UNIQUE INDEX IF NOT EXISTS idx_staffing_offers_token 
  ON staffing_offers (offer_token) WHERE offer_token IS NOT NULL;

-- 2. Crear tabla worker_hours para precarga de horas desde turnos confirmados
CREATE TABLE IF NOT EXISTS worker_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  staffing_line_id UUID REFERENCES staffing_lines(id) ON DELETE SET NULL,
  hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  hour_type TEXT NOT NULL DEFAULT 'planificada' CHECK (hour_type IN ('planificada', 'real', 'extra')),
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'aprobada', 'rechazada')),
  notes TEXT,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para worker_hours
CREATE INDEX IF NOT EXISTS idx_worker_hours_worker ON worker_hours (worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_hours_event ON worker_hours (event_id);
CREATE INDEX IF NOT EXISTS idx_worker_hours_line ON worker_hours (staffing_line_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_hours_unique_line_worker 
  ON worker_hours (staffing_line_id, worker_id) WHERE staffing_line_id IS NOT NULL;

-- Deshabilitar RLS (consistente con el resto del proyecto)
ALTER TABLE worker_hours DISABLE ROW LEVEL SECURITY;

-- 3. Función para calcular horas entre start_time y end_time
CREATE OR REPLACE FUNCTION calculate_hours_between(start_t TIMESTAMPTZ, end_t TIMESTAMPTZ)
RETURNS NUMERIC AS $$
BEGIN
  IF start_t IS NULL OR end_t IS NULL THEN
    RETURN 0;
  END IF;
  RETURN ROUND(EXTRACT(EPOCH FROM (end_t - start_t)) / 3600.0, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- Verificación de la migración
-- ============================================================
DO $$
DECLARE
  v_token_exists BOOLEAN;
  v_hours_exists BOOLEAN;
  v_worker_hours_count INT;
BEGIN
  -- Verificar offer_token
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'staffing_offers' AND column_name = 'offer_token'
  ) INTO v_token_exists;
  
  -- Verificar worker_hours
  SELECT EXISTS(
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'worker_hours'
  ) INTO v_hours_exists;
  
  -- Contar tablas creadas
  SELECT COUNT(*) INTO v_worker_hours_count FROM worker_hours;
  
  RAISE NOTICE 'WP-17 Migration Verification:';
  RAISE NOTICE '  offer_token column exists: %', v_token_exists;
  RAISE NOTICE '  worker_hours table exists: %', v_hours_exists;
  RAISE NOTICE '  worker_hours row count: %', v_worker_hours_count;
  
  IF NOT v_token_exists THEN
    RAISE EXCEPTION 'Migration failed: offer_token column not created';
  END IF;
  
  IF NOT v_hours_exists THEN
    RAISE EXCEPTION 'Migration failed: worker_hours table not created';
  END IF;
  
  RAISE NOTICE 'WP-17 migration completed successfully';
END $$;
