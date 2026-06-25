-- ============================================================
-- EventFlow — Escandallo versionado teórico↔real (FR-C01/C03)  [idempotente]
--   psql "$DATABASE_URL" -f scripts/2026-escandallo-versionado.sql
--
-- Permite el upsert del snapshot de desviación al cerrar el evento.
-- (Las columnas teórico/real ya existen en event_shopping_items.)
-- ============================================================

-- Limpia posibles duplicados previos antes de crear el índice único.
DELETE FROM event_cost_deviations a
USING event_cost_deviations b
WHERE a.event_id = b.event_id AND a.ctid < b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS ux_event_cost_deviations_event
  ON event_cost_deviations(event_id);

SELECT 'escandallo-versionado OK' AS status;
