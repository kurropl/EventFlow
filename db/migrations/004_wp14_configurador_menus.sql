-- ============================================================
-- WP-14: Configurador Web sobre Menús Publicados
-- Migración: Añadir menu_id a leads + tabla menus (si no existe)
-- ============================================================

-- 1. Crear tabla menus si WP-12 no la creó aún
--    (WP-14 depende de WP-12; esta migración es idempotente)
CREATE TABLE IF NOT EXISTS menus (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  version       INT NOT NULL DEFAULT 1,
  status        TEXT NOT NULL DEFAULT 'borrador' CHECK (status IN
                 ('borrador','publicado','pausado','retirado')),
  price_per_pax NUMERIC(10,2) NOT NULL DEFAULT 0,
  description   TEXT,
  parent_menu_id INT REFERENCES menus(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, version)
);

-- 2. Tabla menu_sections (secciones del menú: Aperitivos, Principal, Postre...)
CREATE TABLE IF NOT EXISTS menu_sections (
  id        SERIAL PRIMARY KEY,
  menu_id   INT NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  position  INT NOT NULL DEFAULT 0
);

-- 3. Tabla menu_section_dishes (platos dentro de cada sección)
CREATE TABLE IF NOT EXISTS menu_section_dishes (
  id         SERIAL PRIMARY KEY,
  section_id INT NOT NULL REFERENCES menu_sections(id) ON DELETE CASCADE,
  dish_id    TEXT,            -- FK a catalog_items (plato unificado WP-11)
  dish_name  TEXT,            -- Nombre legible del plato
  variant_tag TEXT           -- NULL | 'celiaco' | 'vegetariano' | 'infantil' | ...
);

-- 4. Tabla event_menus (versión congelada del menú para un evento)
CREATE TABLE IF NOT EXISTS event_menus (
  id        SERIAL PRIMARY KEY,
  event_id  UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  menu_id   INT NOT NULL REFERENCES menus(id),
  pax       INT NOT NULL,
  UNIQUE (event_id, menu_id)
);

-- 5. Añadir menu_id a leads (nullable para compatibilidad con datos existentes)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS menu_id UUID;

-- 6. Índice para búsquedas de leads por menú
CREATE INDEX IF NOT EXISTS idx_leads_menu_id ON leads (menu_id) WHERE menu_id IS NOT NULL;

-- ============================================================
-- SEED: Menús publicados iniciales (los 6 adultos del configurador actual)
-- Solo se insertan si la tabla está vacía (idempotente)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM menus LIMIT 1) THEN
    -- Menu 1: Esencial
    INSERT INTO menus (name, version, status, price_per_pax, description)
    VALUES ('Menú 1', 1, 'publicado', 35.00, 'Menú Esencial — Aperitivos en mesa, plato principal, postre y bebida');
    
    -- Menu 2: Recomendado
    INSERT INTO menus (name, version, status, price_per_pax, description)
    VALUES ('Menú 2', 1, 'publicado', 42.00, 'Menú Recomendado — Aperitivos fríos y calientes, plato principal, postre y bebida');
    
    -- Menu 3: Completo
    INSERT INTO menus (name, version, status, price_per_pax, description)
    VALUES ('Menú 3', 1, 'publicado', 48.00, 'Menú Completo — Aperitivos, mesa a compartir, plato principal, postre y bebida');
    
    -- Menu 4: Premium
    INSERT INTO menus (name, version, status, price_per_pax, description)
    VALUES ('Menú 4', 1, 'publicado', 55.00, 'Menú Premium — Amplia selección fría y caliente, plato principal, postre y bebida');
    
    -- Menu 5: Premium+
    INSERT INTO menus (name, version, status, price_per_pax, description)
    VALUES ('Menú 5', 1, 'publicado', 62.00, 'Menú Premium+ — Selección amplia, aperitivos variados, plato principal, postre y bebida');
    
    -- Menu 6: Gran Selección
    INSERT INTO menus (name, version, status, price_per_pax, description)
    VALUES ('Menú 6', 1, 'publicado', 70.00, 'Menú Gran Selección — La mayor variedad de aperitivos fríos y calientes, postre y bebida');

    -- Menús infantiles
    INSERT INTO menus (name, version, status, price_per_pax, description)
    VALUES ('Menú Niño 1', 1, 'publicado', 18.00, 'Menú Infantil Esencial — Pan, croquetas, pechuga empanada, helado');
    
    INSERT INTO menus (name, version, status, price_per_pax, description)
    VALUES ('Menú Niño 2', 1, 'publicado', 22.00, 'Menú Infantil Plus — Pan, jamón, choco, croquetas, pechuga, helado');

    -- Cócteles
    INSERT INTO menus (name, version, status, price_per_pax, description)
    VALUES ('Cóctel 1', 1, 'publicado', 30.00, 'Cóctel Canapés — Selección fría y caliente de canapés');
    
    INSERT INTO menus (name, version, status, price_per_pax, description)
    VALUES ('Cóctel 2', 1, 'publicado', 38.00, 'Cóctel Premium — Amplia selección con quesos, ibéricos');

    RAISE NOTICE 'WP-14: 10 menús seed insertados en tabla menus';
  ELSE
    RAISE NOTICE 'WP-14: Tabla menus ya tiene datos, seed omitido';
  END IF;
END $$;

-- ============================================================
-- Verificación
-- ============================================================
DO $$
DECLARE
  v_count INT;
  v_leads_menu_id BOOL;
BEGIN
  -- Verificar tabla menus
  SELECT COUNT(*) INTO v_count FROM menus WHERE status = 'publicado';
  RAISE NOTICE 'WP-14 CHECK: Menús publicados en tabla menus: %', v_count;

  -- Verificar columna menu_id en leads
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'menu_id'
  ) INTO v_leads_menu_id;
  RAISE NOTICE 'WP-14 CHECK: leads.menu_id existe: %', v_leads_menu_id;

  -- Verificar tablas de secciones
  SELECT COUNT(*) INTO v_count FROM menu_sections;
  RAISE NOTICE 'WP-14 CHECK: menu_sections creadas: %', v_count;
END $$;
