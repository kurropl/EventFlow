-- ============================================================
-- EventFlow — Workflow de presupuestos (FR-A03)  [idempotente]
--   psql "$DATABASE_URL" -f scripts/2026-quote-workflow.sql
-- Motivo de cancelación obligatorio al descartar un presupuesto.
-- ============================================================

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

SELECT 'quote-workflow OK' AS status;
