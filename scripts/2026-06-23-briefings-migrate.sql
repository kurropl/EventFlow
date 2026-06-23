-- Migración Briefing Camareros
-- EventFlow ERP, J.Benitez
-- Fecha: 2026-06-23

BEGIN;

CREATE TABLE IF NOT EXISTS event_briefings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by  TEXT,
  version       INT NOT NULL DEFAULT 1,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','archived')),
  sent_at       TIMESTAMPTZ,
  content       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_briefings_event ON event_briefings(event_id);
CREATE INDEX IF NOT EXISTS idx_briefings_status ON event_briefings(status);

COMMIT;
