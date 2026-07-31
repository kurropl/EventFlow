-- ============================================================
-- WP-25: Infraestructura del Portal del Cliente
-- Migración: client_portals, portal_magic_links
-- ============================================================
-- Crea las tablas necesarias para el portal público del cliente:
-- - client_portals: acceso principal por token hasheado
-- - portal_magic_links: tokens de sesión temporal por magic link
-- ============================================================

-- 1. Tabla client_portals
CREATE TABLE IF NOT EXISTS client_portals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id        UUID NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  access_token    TEXT NOT NULL UNIQUE,         -- aleatorio >=32 bytes
  token_hash      TEXT NOT NULL UNIQUE,         -- SHA-256 del token para lookup rápido
  status          TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'congelado', 'cerrado')),
  freeze_date     DATE,                         -- fecha_evento - 14 días (configurable)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_access_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_client_portals_event ON client_portals(event_id);
CREATE INDEX IF NOT EXISTS idx_client_portals_token_hash ON client_portals(token_hash);

-- Trigger updated_at
ALTER TABLE client_portals DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_client_portals_updated ON client_portals;
CREATE TRIGGER trg_client_portals_updated
    BEFORE UPDATE ON client_portals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. Tabla portal_magic_links (tokens de sesión temporal)
CREATE TABLE IF NOT EXISTS portal_magic_links (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  portal_id       UUID NOT NULL REFERENCES client_portals(id) ON DELETE CASCADE,
  token           TEXT NOT NULL UNIQUE,          -- token aleatorio
  token_hash      TEXT NOT NULL UNIQUE,          -- SHA-256 del token
  email           TEXT NOT NULL,                 -- email al que se envió
  expires_at      TIMESTAMPTZ NOT NULL,          -- TTL: 24 horas
  used_at         TIMESTAMPTZ,                   -- NULL = no usado aún
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_magic_links_hash ON portal_magic_links(token_hash);
CREATE INDEX IF NOT EXISTS idx_portal_magic_links_portal ON portal_magic_links(portal_id);

ALTER TABLE portal_magic_links DISABLE ROW LEVEL SECURITY;

-- 3. Verificación
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_portals') THEN
    RAISE EXCEPTION 'FAIL: client_portals no existe';
  END IF;
  RAISE NOTICE 'OK: client_portals existe';

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'portal_magic_links') THEN
    RAISE EXCEPTION 'FAIL: portal_magic_links no existe';
  END IF;
  RAISE NOTICE 'OK: portal_magic_links existe';
END $$;
