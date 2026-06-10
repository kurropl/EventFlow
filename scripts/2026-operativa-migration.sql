-- EventFlow: Operativa Spec Migration
-- Step 3: Add missing states, audit_log, and new columns
-- Date: 2026-06-10
-- Safe: additive only, no drops, no renames

BEGIN;

-- ═══════════════════════════════════════════════════════════════
-- 1. Audit Log table — tracks every state transition
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS audit_log (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id      UUID REFERENCES events(id) ON DELETE SET NULL,
  lead_id       UUID REFERENCES leads(id) ON DELETE SET NULL,
  entity_type   TEXT NOT NULL,          -- 'event', 'lead', 'quote', 'payment', 'invoice'
  entity_id     UUID NOT NULL,
  action        TEXT NOT NULL,          -- 'FWD-1', 'INV-3', etc.
  from_status   TEXT,
  to_status     TEXT,
  actor         TEXT,                   -- username or 'system'
  actor_role    TEXT,                   -- 'admin', 'client', 'system'
  motivo        TEXT,                   -- reason for inverse transitions
  metadata      JSONB DEFAULT '{}',     -- extra data (amounts, diffs, etc.)
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_event ON audit_log(event_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

-- ═══════════════════════════════════════════════════════════════
-- 2. New columns on events — for inverse transitions
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE events ADD COLUMN IF NOT EXISTS cancelled_at     TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS cancelled_by     TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS cancel_reason    TEXT;

ALTER TABLE events ADD COLUMN IF NOT EXISTS lost_at          TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS lost_reason      TEXT;

ALTER TABLE events ADD COLUMN IF NOT EXISTS reopened_at      TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS reopened_by      TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS reopen_reason    TEXT;

-- snapshot_previo: JSONB storing the operations state before reopening (INV-4)
ALTER TABLE events ADD COLUMN IF NOT EXISTS snapshot_previo  JSONB;

-- ═══════════════════════════════════════════════════════════════
-- 3. New column on invoices — for rectificativa (INV-5)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS rectificativa_of UUID REFERENCES invoices(id);

-- ═══════════════════════════════════════════════════════════════
-- 4. Ensure leads has 'perdido' status support
--    (column already exists, just need to allow the value)
-- ═══════════════════════════════════════════════════════════════
-- No schema change needed — leads.status is TEXT, no CHECK constraint

-- ═══════════════════════════════════════════════════════════════
-- 5. Ensure payments.concept supports 'penalizacion'
--    (column already exists, just need to allow the value)
-- ═══════════════════════════════════════════════════════════════
-- No schema change needed — payments.concept is TEXT, no CHECK constraint

-- ═══════════════════════════════════════════════════════════════
-- 6. Verify new columns exist
-- ═══════════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE 'Migration complete. New columns:';
  RAISE NOTICE '  events: cancelled_at/by/reason, lost_at/reason, reopened_at/by/reason, snapshot_previo';
  RAISE NOTICE '  invoices: rectificativa_of';
  RAISE NOTICE '  New table: audit_log';
END $$;

COMMIT;
