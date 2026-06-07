-- ============================================================
-- EventFlow — Migración: Fix schema drift (P1 audit)
-- Fecha: 2025-06-07
-- Descripción: Añade tablas y columnas referenciadas en el código
--               pero ausentes del schema.sql original.
-- Idempotente: puede ejecutarse múltiples veces sin errores.
-- ============================================================

-- 1. TABLA guest_forms (formularios de lista de invitados)
--    Referenciada en: /api/guest-forms, /api/admin/guest-forms
CREATE TABLE IF NOT EXISTS guest_forms (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    client_name TEXT,
    email       TEXT,
    guests      JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_guest_forms_event ON guest_forms(event_id);
ALTER TABLE guest_forms DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_guest_forms_updated ON guest_forms;
CREATE TRIGGER trg_guest_forms_updated BEFORE UPDATE ON guest_forms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. COLUMNA events.client_token (enlace único para formulario invitados)
--    Referenciada en: /api/quotes/[id] PUT (accept), /api/guest-forms, /api/event-orders
ALTER TABLE events ADD COLUMN IF NOT EXISTS client_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_client_token ON events(client_token) WHERE client_token IS NOT NULL;

-- 3. TABLA event_shopping_items (escandallo/lista de compras por evento)
--    Referenciada en: /api/shopping, /api/quotes/[id] PUT (accept)
CREATE TABLE IF NOT EXISTS event_shopping_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    order_id        UUID REFERENCES event_orders(id) ON DELETE SET NULL,
    ingredient_name TEXT NOT NULL,
    provider_name   TEXT,
    total_grams     NUMERIC(10,2) DEFAULT 0,
    total_units     INT DEFAULT 0,
    total_ml        INT DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ordered','delivered')),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shopping_event ON event_shopping_items(event_id);
ALTER TABLE event_shopping_items DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_shopping_updated ON event_shopping_items;
CREATE TRIGGER trg_shopping_updated BEFORE UPDATE ON event_shopping_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. TABLA waiters (camareros del salón)
--    Referenciada en: /api/waiters CRUD
CREATE TABLE IF NOT EXISTS waiters (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name       TEXT NOT NULL,
    role       TEXT DEFAULT 'camarero',
    phone      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE waiters DISABLE ROW LEVEL SECURITY;
