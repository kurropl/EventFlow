-- Mapa de Mesas — tabla de persistencia
CREATE TABLE IF NOT EXISTS event_floorplans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Salón de Celebraciones',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id)
);

CREATE INDEX IF NOT EXISTS idx_floorplans_event ON event_floorplans(event_id);

-- Auto-asignación: asignar invitados a mesas
CREATE TABLE IF NOT EXISTS table_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  table_id TEXT NOT NULL,
  guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
  guest_name TEXT NOT NULL,
  seat_number INT NOT NULL DEFAULT 0,
  dietary_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, table_id, guest_id)
);

CREATE INDEX IF NOT EXISTS idx_table_assignments_event ON table_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_table_assignments_table ON table_assignments(table_id);