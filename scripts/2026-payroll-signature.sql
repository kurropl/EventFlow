-- ============================================================
-- EventFlow — Nómina por trabajador + firma (FR-A09)  [idempotente]
--   psql "$DATABASE_URL" -f scripts/2026-payroll-signature.sql
-- ============================================================
CREATE TABLE IF NOT EXISTS worker_event_pay (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id     UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    hours         NUMERIC(6,2) NOT NULL DEFAULT 0,
    hourly_rate   NUMERIC(8,2) NOT NULL DEFAULT 0,
    total_pay     NUMERIC(10,2) NOT NULL DEFAULT 0,
    status        TEXT NOT NULL DEFAULT 'pending',
    paid_at       TIMESTAMPTZ,
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Firma tras el pago (FR-A09)
ALTER TABLE worker_event_pay
  ADD COLUMN IF NOT EXISTS signature_url TEXT,
  ADD COLUMN IF NOT EXISTS signed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_by     TEXT;
CREATE INDEX IF NOT EXISTS idx_worker_event_pay_event ON worker_event_pay(event_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_event_pay_unique ON worker_event_pay(worker_id, event_id);
ALTER TABLE worker_event_pay DISABLE ROW LEVEL SECURITY;

SELECT 'payroll-signature OK' AS status;
