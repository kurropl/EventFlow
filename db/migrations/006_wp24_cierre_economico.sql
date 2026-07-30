-- ============================================================
-- WP-24: Cierre Económico del Evento
-- Migración: Tabla event_financial_closures + constraint cerrado_contable
-- ============================================================

-- 1. Tabla event_financial_closures (según spec §4)
CREATE TABLE IF NOT EXISTS event_financial_closures (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  
  -- Costes previstos (escandallo WP-05 + staff planificado WP-17)
  planned_food_cost     NUMERIC(12,2),      -- Coste comida teórico del escandallo
  planned_staff_cost    NUMERIC(12,2),      -- Coste personal planificado (horas estimadas × tarifa)
  
  -- Costes reales (mermas+consumos WP-09, horas aprobadas, compras imputadas WP-06)
  real_food_cost        NUMERIC(12,2),      -- Coste comida real (consumo registrado)
  real_staff_cost       NUMERIC(12,2),      -- Coste personal real (nóminas aprobadas)
  
  -- Ingresos
  extras_revenue        NUMERIC(12,2),      -- Ingresos por extras (WP-29)
  total_revenue         NUMERIC(12,2),      -- Ingresos totales (PVP)
  
  -- Margen
  real_margin_pct       NUMERIC(6,2),       -- Margen real = (total_revenue - real_food_cost - real_staff_cost) / total_revenue * 100
  
  -- Cierre contable
  frozen                BOOLEAN NOT NULL DEFAULT false,  -- TRUE = cerrado contablemente, no admite cambios
  closed_by             UUID REFERENCES admins(id),       -- Gerente que cierra contablemente
  closed_at             TIMESTAMPTZ,                      -- Fecha/hora del cierre contable
  
  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_event_financial_closures_event ON event_financial_closures(event_id);

-- Trigger para updated_at
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_event_financial_closures_updated') THEN
    CREATE TRIGGER trg_event_financial_closures_updated 
      BEFORE UPDATE ON event_financial_closures
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- 2. Añadir transición OPC-5 al CHECK de events (cerrado_operativo → cerrado_contable)
-- El constraint ya existe de WP-18, solo verificamos que incluya cerrado_contable
DO $$
DECLARE
  constraint_def TEXT;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO constraint_def
  FROM pg_constraint
  WHERE conname = 'events_status_check' AND conrelid = 'events'::regclass;
  
  IF constraint_def IS NULL OR constraint_def NOT LIKE '%cerrado_contable%' THEN
    ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check;
    ALTER TABLE events ADD CONSTRAINT events_status_check
      CHECK (status IN (
        -- Estados legados (existentes en español)
        'nuevo', 'propuesta_enviada', 'confirmado', 'cancelado', 'en_curso', 'completado',
        -- Estados nuevos WP-04/18/24
        'en_preparacion', 'cerrado_operativo', 'cerrado_contable',
        -- Estados en inglés (schema.sql actual)
        'draft', 'sent', 'accepted', 'in_progress', 'completed', 'paid', 'cancelled', 'lost', 'reopened'
      ));
    RAISE NOTICE 'Constraint events_status_check actualizado con cerrado_contable';
  ELSE
    RAISE NOTICE 'Constraint events_status_check ya contiene cerrado_contable';
  END IF;
END $$;

-- 3. Script de verificación
DO $$
BEGIN
  -- Verificar que la tabla fue creada
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'event_financial_closures') THEN
    RAISE EXCEPTION 'Tabla event_financial_closures no fue creada';
  END IF;
  
  -- Verificar columnas clave
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_financial_closures' AND column_name = 'frozen'
  ) THEN
    RAISE EXCEPTION 'Columna frozen no encontrada';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_financial_closures' AND column_name = 'real_margin_pct'
  ) THEN
    RAISE EXCEPTION 'Columna real_margin_pct no encontrada';
  END IF;
  
  -- Verificar constraint incluye cerrado_contable
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_status_check'
    AND pg_get_constraintdef(oid) LIKE '%cerrado_contable%'
  ) THEN
    RAISE EXCEPTION 'Constraint events_status_check no incluye cerrado_contable';
  END IF;
  
  RAISE NOTICE 'Migración WP-24 completada exitosamente';
END $$;
