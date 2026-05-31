-- ============================================================
-- EventFlow — BodaLab modules migration
-- Idempotent. Run after schema.sql on the existing database:
--   psql "$DATABASE_URL" -f scripts/bodalab-modules.sql
-- Adds: clients (CRM), payments (cobros), guests (invitados), appointments (agenda)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Shared updated_at trigger function (safe to redefine)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- CLIENTS (CRM) — ficha de cliente con historial y notas
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    email       TEXT,
    phone       TEXT,
    company     TEXT,
    tags        JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_email ON clients (lower(email)) WHERE email IS NOT NULL;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_clients_updated ON clients;
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Link events to a client (optional; events keep denormalised contact fields)
ALTER TABLE events ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- ============================================================
-- PAYMENTS (Facturación y Cobros) — anticipos, señales, vencimientos
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    concept     TEXT NOT NULL DEFAULT 'Pago',
    amount      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    due_date    DATE,
    paid        BOOLEAN NOT NULL DEFAULT false,
    paid_date   DATE,
    method      TEXT,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_event ON payments(event_id);
CREATE INDEX IF NOT EXISTS idx_payments_due ON payments(due_date) WHERE paid = false;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_payments_updated ON payments;
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- GUESTS (Invitados + RSVP + restricciones dietéticas)
-- ============================================================
CREATE TABLE IF NOT EXISTS guests (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    group_name   TEXT,
    rsvp         TEXT NOT NULL DEFAULT 'pendiente' CHECK (rsvp IN ('pendiente','confirmado','rechazado')),
    menu_type    TEXT NOT NULL DEFAULT 'adulto' CHECK (menu_type IN ('adulto','nino','bebe')),
    dietary      JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_guests_event ON guests(event_id);
ALTER TABLE guests DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_guests_updated ON guests;
CREATE TRIGGER trg_guests_updated BEFORE UPDATE ON guests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- APPOINTMENTS (Agenda — citas comerciales, bloqueos de fecha, notas)
-- ============================================================
CREATE TABLE IF NOT EXISTS appointments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title       TEXT NOT NULL,
    kind        TEXT NOT NULL DEFAULT 'cita' CHECK (kind IN ('cita','bloqueo','nota')),
    event_id    UUID REFERENCES events(id) ON DELETE SET NULL,
    start_date  DATE NOT NULL,
    end_date    DATE,
    start_time  TEXT,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(start_date);
ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_appointments_updated ON appointments;
CREATE TRIGGER trg_appointments_updated BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
