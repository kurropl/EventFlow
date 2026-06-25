-- ============================================================
-- EventFlow — Facturas/deuda de proveedores (FR-A10)  [idempotente]
--   psql "$DATABASE_URL" -f scripts/2026-provider-invoices.sql
-- ============================================================
CREATE TABLE IF NOT EXISTS provider_invoices (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id  UUID REFERENCES providers(id) ON DELETE CASCADE,
    concept      TEXT,
    amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
    issue_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date     DATE,
    status       TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','pagado','vencido')),
    proof_url    TEXT,
    paid_at      TIMESTAMPTZ,
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_provider_invoices_provider ON provider_invoices(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_invoices_status ON provider_invoices(status);
ALTER TABLE provider_invoices DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_provider_invoices_updated ON provider_invoices;
CREATE TRIGGER trg_provider_invoices_updated BEFORE UPDATE ON provider_invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

SELECT 'provider-invoices OK' AS status;
