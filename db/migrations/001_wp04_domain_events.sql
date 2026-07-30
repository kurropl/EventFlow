-- ============================================================
-- WP-04: Outbox, Worker y Máquina de Estados
-- Migración: Tabla domain_events + ampliación de estados de events
-- ============================================================

-- 1. Tabla domain_events (outbox de eventos de dominio)
CREATE TABLE IF NOT EXISTS domain_events (
  id            BIGSERIAL PRIMARY KEY,
  event_type    TEXT NOT NULL,              -- catálogo §5
  aggregate_type TEXT NOT NULL,             -- 'event','purchase_order','menu',...
  aggregate_id  TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at  TIMESTAMPTZ,                -- NULL = pendiente
  attempts      INT NOT NULL DEFAULT 0,
  last_error    TEXT
);

CREATE INDEX IF NOT EXISTS idx_domain_events_pending
  ON domain_events (created_at) WHERE processed_at IS NULL;

-- 2. Ampliar el CHECK de estados en events para incluir nuevos estados
-- Primero eliminar el constraint viejo
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check;

-- Crear nuevo constraint con todos los estados (legados + nuevos)
ALTER TABLE events ADD CONSTRAINT events_status_check
  CHECK (status IN (
    -- Estados legados (existentes)
    'nuevo', 'propuesta_enviada', 'confirmado', 'cancelado', 'en_curso', 'completado',
    -- Nuevos estados WP-04
    'en_preparacion', 'cerrado_operativo', 'cerrado_contable'
    -- Nota: 'completado' se conserva como alias legado de 'cerrado_operativo'
  ));

-- 3. Script de verificación
DO $$
BEGIN
  -- Verificar que la tabla domain_events fue creada
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'domain_events') THEN
    RAISE EXCEPTION 'Tabla domain_events no fue creada';
  END IF;

  -- Verificar que el constraint de estados incluye los nuevos
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_status_check'
    AND pg_get_constraintdef(oid) LIKE '%en_preparacion%'
  ) THEN
    RAISE EXCEPTION 'Constraint events_status_check no incluye en_preparacion';
  END IF;

  RAISE NOTICE 'Migración WP-04 completada exitosamente';
END $$;