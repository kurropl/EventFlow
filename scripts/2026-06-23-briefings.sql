-- Briefing Camareros — documento operativo previo al evento
CREATE TABLE IF NOT EXISTS event_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by VARCHAR(255),
  version INT NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','archived')),
  sent_at TIMESTAMPTZ,

  -- Contenido estructurado generado automáticamente
  content JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_briefings_event ON event_briefings(event_id);

-- Briefing por camarero (asignaciones individuales)
CREATE TABLE IF NOT EXISTS briefing_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_id UUID NOT NULL REFERENCES event_briefings(id) ON DELETE CASCADE,
  waiter_id UUID NOT NULL REFERENCES waiters(id) ON DELETE CASCADE,
  role VARCHAR(100),
  zone VARCHAR(200),
  assigned_tables JSONB DEFAULT '[]'::jsonb, -- [{table_id, table_name, guests}]
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_briefing_assignments_briefing ON briefing_assignments(briefing_id);
CREATE INDEX idx_briefing_assignments_waiter ON briefing_assignments(waiter_id);