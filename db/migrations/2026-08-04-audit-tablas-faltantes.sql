-- ============================================================
-- EventFlow — 2026-08-04: Auditoría worktrees (skills superpowers/mattpocock)
-- GAP: 5 tablas usadas en el código (mergeado de WPs) NO existen en prod.
--
-- Hallazgo de auditoría (verification-before-completion + diagnosing-bugs):
--   briefing_send_log      — cron pre-event-briefing (envío memos, idempotencia)
--   event_contracts        — /api/events/[id]/contract (+ public sign/void)
--   inventory_commitments  — trazabilidad lot-consumption / receiving / portalFrozen
--   menu_cost_alerts       — handler ingredientPriceChanged + /api/cost-alerts
--   venue_bookings         — domain/venueBooking.ts
--
-- Las 5 viven en schema.sql (fuente de verdad) y en la BD seed, pero la BD
-- prod se creó sin ellas → cualquier ruta que las toque devuelve 500
-- "relation ... does not exist". Esta migración las crea de forma ADITIVA
-- e idempotente (CREATE TABLE IF NOT EXISTS + índices IF NOT EXISTS).
-- ============================================================

-- ── 0. Prerequisito: btree_gist (EXCLUDE gist de venue_bookings) ─────
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ── 1. venues (SPRINT 2 · G1) + seed de salones ──────────────────────
CREATE TABLE IF NOT EXISTS venues (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        TEXT NOT NULL UNIQUE,          -- 'salon-arriba' | 'salon-abajo'
    name        TEXT NOT NULL,
    capacity    INT,
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO venues (slug, name, capacity) VALUES
    ('salon-arriba', 'Salón de Arriba', 180),
    ('salon-abajo',  'Salón de Abajo',  120)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES venues(id) ON DELETE SET NULL;

-- ── 2. venue_bookings (SPRINT 2 · G1) ─────────────────────────────
CREATE TABLE IF NOT EXISTS venue_bookings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id    UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    event_id    UUID NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
    event_date  DATE NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT venue_bookings_no_overlap
        EXCLUDE USING gist (
            venue_id WITH =,
            daterange(event_date, event_date + 1) WITH &&
        )
);
CREATE INDEX IF NOT EXISTS idx_venue_bookings_event ON venue_bookings(event_id);
CREATE INDEX IF NOT EXISTS idx_venue_bookings_venue_date ON venue_bookings(venue_id, event_date);

-- ── 3. inventory_commitments (SPRINT 2 · G2) ──────────────────────
CREATE TABLE IF NOT EXISTS inventory_commitments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    qty_committed NUMERIC(12,3) NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (event_id, ingredient_id)
);
CREATE INDEX IF NOT EXISTS idx_inv_commitments_ingredient ON inventory_commitments(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_inv_commitments_event ON inventory_commitments(event_id);

-- ── 4. event_contracts (SPRINT 4 · D2) ────────────────────────────
CREATE TABLE IF NOT EXISTS event_contracts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    quote_id        UUID REFERENCES quotes(id) ON DELETE SET NULL,
    content_html    TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','signed','voided')),
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    signed_at       TIMESTAMPTZ,
    signed_by_name  TEXT,
    signed_by_nif   TEXT,
    signature_data  TEXT,
    signer_ip       TEXT,
    voided_at       TIMESTAMPTZ,
    voided_reason   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_contracts_event ON event_contracts(event_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_contracts_active
  ON event_contracts(event_id) WHERE status != 'voided';

-- ── 5. briefing_send_log (SPRINT 6 · F0.3) ────────────────────────
CREATE TABLE IF NOT EXISTS briefing_send_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  worker_id   UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  channel     TEXT NOT NULL CHECK (channel IN ('email','whatsapp')),
  status      TEXT NOT NULL CHECK (status IN ('sent','failed')),
  error       TEXT,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, worker_id, channel)
);
CREATE INDEX IF NOT EXISTS idx_briefing_send_log_event ON briefing_send_log(event_id);

-- ── 6. menu_cost_alerts (WP-13) — menus.id es UUID en prod ───────
CREATE TABLE IF NOT EXISTS menu_cost_alerts (
  id            SERIAL PRIMARY KEY,
  menu_id       UUID NOT NULL REFERENCES menus(id),
  alert_type    TEXT NOT NULL CHECK (alert_type IN ('margen_bajo', 'coste_subido')),
  old_margin    NUMERIC(6,2),
  new_margin    NUMERIC(6,2),
  old_cost      NUMERIC(10,2),
  new_cost      NUMERIC(10,2),
  ingredient_id UUID,
  threshold     NUMERIC(5,2) NOT NULL,
  resolved      BOOLEAN NOT NULL DEFAULT false,
  resolved_at   TIMESTAMPTZ,
  resolved_by   UUID,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Verificación ─────────────────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('venue_bookings','inventory_commitments','event_contracts',
                     'briefing_send_log','menu_cost_alerts')
ORDER BY table_name;
