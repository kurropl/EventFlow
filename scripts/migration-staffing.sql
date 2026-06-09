-- EventFlow — Staffing Module Migration
-- Creates: workers, staffing_lines, staffing_offers, staffing_assignments

-- ============================================================
-- 1. Workers (trabajadores del salón)
-- ============================================================
CREATE TABLE IF NOT EXISTS workers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,               -- E.164 format: +34612345678
  roles TEXT[] NOT NULL DEFAULT '{}', -- ['camarero', 'barman', 'azafata', ...]
  default_uniform TEXT,              -- Vestimenta por defecto
  availability JSONB NOT NULL DEFAULT '{}',
  /*  Example availability:
      {
        "monday":    {"start": "09:00", "end": "22:00"},
        "tuesday":   {"start": "09:00", "end": "22:00"},
        "wednesday": null,
        "thursday":  {"start": "10:00", "end": "23:00"},
        "friday":    {"start": "08:00", "end": "02:00"},
        "saturday":  {"start": "08:00", "end": "02:00"},
        "sunday":    null
      }
  */
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workers_roles ON workers USING GIN (roles);
CREATE INDEX IF NOT EXISTS idx_workers_active ON workers (active) WHERE active = true;

-- ============================================================
-- 2. Staffing Lines (necesidad de personal por evento)
-- ============================================================
CREATE TABLE IF NOT EXISTS staffing_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  role TEXT NOT NULL,                  -- 'camarero', 'barman', 'azafata', ...
  slots_needed INTEGER NOT NULL DEFAULT 1,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  location TEXT,                       -- 'Zona A', 'Terraza', ...
  uniform TEXT,                        -- Vestimenta específica para esta línea
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'filled', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staffing_lines_event ON staffing_lines (event_id);
CREATE INDEX IF NOT EXISTS idx_staffing_lines_status ON staffing_lines (status);

-- ============================================================
-- 3. Staffing Offers (ofertas enviadas a trabajadores)
-- ============================================================
CREATE TABLE IF NOT EXISTS staffing_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staffing_line_id UUID NOT NULL REFERENCES staffing_lines(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'accepted', 'rejected', 'expired')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staffing_offers_line ON staffing_offers (staffing_line_id);
CREATE INDEX IF NOT EXISTS idx_staffing_offers_worker ON staffing_offers (worker_id);
CREATE INDEX IF NOT EXISTS idx_staffing_offers_status ON staffing_offers (status);

-- Prevent duplicate offers for same line+worker
CREATE UNIQUE INDEX IF NOT EXISTS idx_staffing_offers_unique 
  ON staffing_offers (staffing_line_id, worker_id);

-- ============================================================
-- 4. Staffing Assignments (plazas asignadas)
-- ============================================================
CREATE TABLE IF NOT EXISTS staffing_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staffing_line_id UUID NOT NULL REFERENCES staffing_lines(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  offer_id UUID REFERENCES staffing_offers(id),
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  position INTEGER NOT NULL,  -- Orden de confirmación (1, 2, 3...)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staffing_assignments_line ON staffing_assignments (staffing_line_id);
CREATE INDEX IF NOT EXISTS idx_staffing_assignments_worker ON staffing_assignments (worker_id);

-- Prevent double assignment for same line+worker
CREATE UNIQUE INDEX IF NOT EXISTS idx_staffing_assignments_unique 
  ON staffing_assignments (staffing_line_id, worker_id);

-- ============================================================
-- 5. Seed demo workers
-- ============================================================
INSERT INTO workers (name, phone, roles, default_uniform, availability) VALUES
  ('María López', '+34612345001', ARRAY['camarero', 'azafata'], 'Traje negro + camisa blanca',
   '{"monday":{"start":"09:00","end":"22:00"},"tuesday":{"start":"09:00","end":"22:00"},"wednesday":null,"thursday":{"start":"10:00","end":"23:00"},"friday":{"start":"08:00","end":"02:00"},"saturday":{"start":"08:00","end":"02:00"},"sunday":null}'),
  ('Carlos Ruiz', '+34612345002', ARRAY['barman', 'camarero'], 'Chaleco negro + camisa blanca',
   '{"monday":{"start":"10:00","end":"23:00"},"tuesday":{"start":"10:00","end":"23:00"},"wednesday":{"start":"10:00","end":"23:00"},"thursday":{"start":"10:00","end":"23:00"},"friday":{"start":"08:00","end":"03:00"},"saturday":{"start":"08:00","end":"03:00"},"sunday":{"start":"10:00","end":"22:00"}}'),
  ('Ana Martín', '+34612345003', ARRAY['azafata'], 'Vestido rojo + zapatos negros',
   '{"monday":null,"tuesday":null,"wednesday":{"start":"14:00","end":"22:00"},"thursday":{"start":"14:00","end":"22:00"},"friday":{"start":"12:00","end":"02:00"},"saturday":{"start":"12:00","end":"02:00"},"sunday":null}'),
  ('Pedro Sánchez', '+34612345004', ARRAY['camarero'], 'Traje negro completo',
   '{"monday":{"start":"08:00","end":"20:00"},"tuesday":{"start":"08:00","end":"20:00"},"wednesday":{"start":"08:00","end":"20:00"},"thursday":{"start":"08:00","end":"20:00"},"friday":{"start":"08:00","end":"02:00"},"saturday":{"start":"08:00","end":"02:00"},"sunday":{"start":"10:00","end":"18:00"}}'),
  ('Laura García', '+34612345005', ARRAY['camarero', 'barman'], 'Polo negro EventFlow',
   '{"monday":{"start":"09:00","end":"21:00"},"tuesday":{"start":"09:00","end":"21:00"},"wednesday":{"start":"09:00","end":"21:00"},"thursday":{"start":"09:00","end":"21:00"},"friday":{"start":"09:00","end":"02:00"},"saturday":{"start":"09:00","end":"02:00"},"sunday":null}')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. Seed demo staffing lines for María García event
-- ============================================================
INSERT INTO staffing_lines (event_id, role, slots_needed, start_time, end_time, location, uniform, status)
SELECT 
  e.id,
  'camarero',
  4,
  e.event_date + TIME '18:00',
  e.event_date + TIME '02:00',
  'Sala principal',
  'Traje negro + camisa blanca',
  'open'
FROM events e
WHERE e.client_name = 'María García'
  AND NOT EXISTS (SELECT 1 FROM staffing_lines sl WHERE sl.event_id = e.id AND sl.role = 'camarero')
LIMIT 1;

INSERT INTO staffing_lines (event_id, role, slots_needed, start_time, end_time, location, uniform, status)
SELECT 
  e.id,
  'barman',
  2,
  e.event_date + TIME '17:00',
  e.event_date + TIME '02:00',
  'Zona bar',
  'Chaleco negro + delantal',
  'open'
FROM events e
WHERE e.client_name = 'María García'
  AND NOT EXISTS (SELECT 1 FROM staffing_lines sl WHERE sl.event_id = e.id AND sl.role = 'barman')
LIMIT 1;

INSERT INTO staffing_lines (event_id, role, slots_needed, start_time, end_time, location, uniform, status)
SELECT 
  e.id,
  'azafata',
  2,
  e.event_date + TIME '19:00',
  e.event_date + TIME '01:00',
  'Entrada y recepción',
  'Vestido rojo + zapatos negros',
  'open'
FROM events e
WHERE e.client_name = 'María García'
  AND NOT EXISTS (SELECT 1 FROM staffing_lines sl WHERE sl.event_id = e.id AND sl.role = 'azafata')
LIMIT 1;
