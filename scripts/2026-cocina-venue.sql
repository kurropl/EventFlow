-- ============================================================
-- EventFlow — Cocina & Venue (FR-A07/A08/A11, FR-C06/C07)  [idempotente]
--   psql "$DATABASE_URL" -f scripts/2026-cocina-venue.sql
--
-- Habilita el módulo Cocina como GUÍA condicionada por la ubicación del evento
-- (dentro del local "Benítez" vs ubicación externa) y el desglose por pase.
-- ============================================================

-- ── Ubicación del evento (FR-A07/A11) ─────────────────────────────────────
--   benitez = evento en el local propio  ·  externo = catering desplazado.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS venue_type   TEXT NOT NULL DEFAULT 'benitez'
    CHECK (venue_type IN ('benitez','externo')),
  ADD COLUMN IF NOT EXISTS location     TEXT,           -- dirección / nombre del sitio externo
  ADD COLUMN IF NOT EXISTS venue_pdf_url TEXT;           -- plano del venue externo (sitting)

-- ── Menú: seleccionado vs sugerencia + pase (FR-A08/C06) ──────────────────
ALTER TABLE event_menu_items
  ADD COLUMN IF NOT EXISTS kind          TEXT NOT NULL DEFAULT 'seleccionado'
    CHECK (kind IN ('seleccionado','sugerencia')),
  ADD COLUMN IF NOT EXISTS service_round INT NOT NULL DEFAULT 1;   -- pase (1=aperitivo, 2=principal, …)

-- ── Ingredientes: material/equipamiento vs seco vs perecedero (FR-C07) ─────
--   La Hoja Logística separa equipamiento (no se compra, se transporta) y
--   producto seco (no perecedero) de los perecederos.
ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS is_equipment BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_dry       BOOLEAN NOT NULL DEFAULT false;

SELECT 'cocina-venue OK' AS status;
