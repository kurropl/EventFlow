-- ============================================================
-- EventFlow — Fase 0 · events.service_type (FR-A05)  [idempotente]
--   psql "$DATABASE_URL" -f scripts/2026-fase0-service-type.sql
--
-- Habilita el cálculo de camareros por tipo de servicio (src/lib/operations.ts):
--   coctel → ceil(pax/12) ;  menu → ceil(pax/10) + floor(pax/25)
-- (Añadir también esta columna a schema.sql en su sección de `events`.)
-- ============================================================

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS service_type TEXT NOT NULL DEFAULT 'menu'
  CHECK (service_type IN ('coctel', 'menu'));
