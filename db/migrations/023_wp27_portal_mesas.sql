-- ============================================================
-- WP-27: Portal — Distribución de Mesas
-- Migración: client_portals (base WP-25 necesaria para WP-27)
-- ============================================================
-- NOTA: client_portals es prerequisito de WP-27. Se crea aquí
-- porque WP-25 no existe aún y WP-27 lo necesita.

-- 1. Tabla client_portals
CREATE TABLE IF NOT EXISTS client_portals (
  id              SERIAL PRIMARY KEY,
  event_id        UUID NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  access_token    TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL DEFAULT 'activo'
                  CHECK (status IN ('activo','congelado','cerrado')),
  freeze_date     DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '14 days'),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_access_at  TIMESTAMPTZ
);

-- Index para búsqueda por token
CREATE INDEX IF NOT EXISTS idx_client_portals_token
  ON client_portals (access_token);

-- Index para job diario de congelación
CREATE INDEX IF NOT EXISTS idx_client_portals_freeze
  ON client_portals (freeze_date, status)
  WHERE status = 'activo';

-- 2. Script de verificación
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'client_portals'
  ) THEN
    RAISE EXCEPTION 'Tabla client_portals no fue creada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_portals' AND column_name = 'access_token'
  ) THEN
    RAISE EXCEPTION 'Columna access_token no encontrada en client_portals';
  END IF;

  RAISE NOTICE 'Migración WP-27 completada exitosamente';
END $$;
