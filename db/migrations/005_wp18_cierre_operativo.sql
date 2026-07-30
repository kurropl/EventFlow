-- ============================================================
-- WP-18: Cierre Operativo del Evento
-- Migración: Tabla event_closure_checklists + estados
-- ============================================================

-- 1. Tabla event_closure_checklists
CREATE TABLE IF NOT EXISTS event_closure_checklists (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  
  -- Los 4 checks del checklist
  logistics_returned    BOOLEAN NOT NULL DEFAULT false,  -- Logística retornada (WP-09)
  waste_recorded        BOOLEAN NOT NULL DEFAULT false,  -- Mermas registradas (WP-09)
  hours_validated       BOOLEAN NOT NULL DEFAULT false,  -- Horas aprobadas (WP-17)
  appcc_resolved        BOOLEAN NOT NULL DEFAULT false,  -- APPCC sin incidencias abiertas
  
  -- Override por Gerente (sobreescribible con motivo)
  logistics_override    BOOLEAN,                          -- NULL = autocompletado, TRUE/FALSE = override manual
  waste_override        BOOLEAN,
  hours_override        BOOLEAN,
  appcc_override        BOOLEAN,
  override_reason       TEXT,                             -- Motivo del override (obligatorio si hay override)
  
  -- Cierre
  closed_by             UUID REFERENCES admins(id),
  closed_at             TIMESTAMPTZ,
  
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_event_closure_event ON event_closure_checklists(event_id);

-- Trigger para updated_at
CREATE TRIGGER trg_event_closure_updated BEFORE UPDATE ON event_closure_checklists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. Añadir estados faltantes al CHECK de events (si no existen)
-- Los estados 'cerrado_operativo' y 'en_curso' deben existir
DO $$
DECLARE
  constraint_def TEXT;
BEGIN
  -- Obtener la definición actual del constraint
  SELECT pg_get_constraintdef(oid) INTO constraint_def
  FROM pg_constraint
  WHERE conname = 'events_status_check' AND conrelid = 'events'::regclass;
  
  -- Si no contiene 'cerrado_operativo', recrear el constraint
  IF constraint_def IS NULL OR constraint_def NOT LIKE '%cerrado_operativo%' THEN
    ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check;
    ALTER TABLE events ADD CONSTRAINT events_status_check
      CHECK (status IN (
        -- Estados legados (existentes en español)
        'nuevo', 'propuesta_enviada', 'confirmado', 'cancelado', 'en_curso', 'completado',
        -- Estados nuevos WP-04/18
        'en_preparacion', 'cerrado_operativo', 'cerrado_contable',
        -- Estados en inglés (schema.sql actual)
        'draft', 'sent', 'accepted', 'in_progress', 'completed', 'paid', 'cancelled', 'lost', 'reopened'
      ));
    RAISE NOTICE 'Constraint events_status_check actualizado con cerrado_operativo';
  ELSE
    RAISE NOTICE 'Constraint events_status_check ya contiene cerrado_operativo';
  END IF;
END $$;

-- 3. Script de verificación
DO $$
BEGIN
  -- Verificar que la tabla fue creada
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'event_closure_checklists') THEN
    RAISE EXCEPTION 'Tabla event_closure_checklists no fue creada';
  END IF;
  
  -- Verificar que tiene las columnas correctas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_closure_checklists' AND column_name = 'logistics_returned'
  ) THEN
    RAISE EXCEPTION 'Columna logistics_returned no encontrada';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_closure_checklists' AND column_name = 'override_reason'
  ) THEN
    RAISE EXCEPTION 'Columna override_reason no encontrada';
  END IF;
  
  -- Verificar constraint de estados incluye cerrado_operativo
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_status_check'
    AND pg_get_constraintdef(oid) LIKE '%cerrado_operativo%'
  ) THEN
    RAISE EXCEPTION 'Constraint events_status_check no incluye cerrado_operativo';
  END IF;
  
  RAISE NOTICE 'Migración WP-18 completada exitosamente';
END $$;
