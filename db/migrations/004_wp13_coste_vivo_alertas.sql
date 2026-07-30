-- ============================================================
-- WP-13: Coste Vivo y Alertas de Margen
-- Migración: Tablas WP-12 (menús) + umbral configurable + alertas
-- ============================================================
-- NOTA: Las tablas de WP-12 (menus, menu_sections, menu_section_dishes)
-- se crean aquí porque WP-13 depende de WP-12 y el worktree no las tiene.

-- 1. Tabla menus (WP-12)
CREATE TABLE IF NOT EXISTS menus (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  version       INT NOT NULL DEFAULT 1,
  status        TEXT NOT NULL DEFAULT 'borrador' CHECK (status IN
                 ('borrador','publicado','pausado','retirado')),
  price_per_pax NUMERIC(10,2) NOT NULL,
  cost_per_pax  NUMERIC(10,2) NOT NULL DEFAULT 0,
  description   TEXT,
  parent_menu_id INT REFERENCES menus(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, version)
);

-- 2. Tabla menu_sections (WP-12)
CREATE TABLE IF NOT EXISTS menu_sections (
  id        SERIAL PRIMARY KEY,
  menu_id   INT NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  position  INT NOT NULL DEFAULT 0
);

-- 3. Tabla menu_section_dishes (WP-12)
CREATE TABLE IF NOT EXISTS menu_section_dishes (
  id          SERIAL PRIMARY KEY,
  section_id  INT NOT NULL REFERENCES menu_sections(id) ON DELETE CASCADE,
  dish_id     UUID NOT NULL REFERENCES catalog_items(id),
  variant_tag TEXT
);

-- 4. Umbral de alerta de margen en business_settings
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS margin_alert_threshold NUMERIC(5,2) NOT NULL DEFAULT 20;

-- 5. Tabla de alertas de margen para dashboard
CREATE TABLE IF NOT EXISTS menu_cost_alerts (
  id            SERIAL PRIMARY KEY,
  menu_id       INT NOT NULL REFERENCES menus(id),
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

CREATE INDEX IF NOT EXISTS idx_menu_cost_alerts_pending
  ON menu_cost_alerts (created_at) WHERE resolved = false;

-- 6. Script de verificación
DO $$
BEGIN
  -- Verificar tablas WP-12
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'menus') THEN
    RAISE EXCEPTION 'Tabla menus no fue creada';
  END IF;
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'menu_sections') THEN
    RAISE EXCEPTION 'Tabla menu_sections no fue creada';
  END IF;
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'menu_section_dishes') THEN
    RAISE EXCEPTION 'Tabla menu_section_dishes no fue creada';
  END IF;

  -- Verificar columna umbral
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_settings' AND column_name = 'margin_alert_threshold'
  ) THEN
    RAISE EXCEPTION 'Columna margin_alert_threshold no fue agregada';
  END IF;

  -- Verificar tabla de alertas
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'menu_cost_alerts') THEN
    RAISE EXCEPTION 'Tabla menu_cost_alerts no fue creada';
  END IF;

  RAISE NOTICE 'Migración WP-13 completada exitosamente';
END $$;
