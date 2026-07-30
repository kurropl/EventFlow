-- ============================================================
-- WP-12: Menú con estados, versionado y variantes
-- Migración 004_wp12_menus.sql
-- ============================================================
-- Idempotente: usa IF NOT EXISTS
-- ============================================================

-- 1. TABLA PRINCIPAL DE MENÚS
CREATE TABLE IF NOT EXISTS menus (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    version         INT NOT NULL DEFAULT 1,
    status          TEXT NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador','publicado','pausado','retirado')),
    price_per_pax   NUMERIC(10,2) NOT NULL CHECK (price_per_pax >= 0),
    description     TEXT,
    parent_menu_id  UUID REFERENCES menus(id) ON DELETE SET NULL,
    cost_per_pax    NUMERIC(10,2) DEFAULT 0,  -- calculado = Σ coste platos / pax
    margin_pct      NUMERIC(5,2) DEFAULT 0,   -- calculado = (price_per_pax - cost_per_pax) / price_per_pax * 100
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID, -- admins.id del usuario que creó
    UNIQUE (name, version)
);

CREATE INDEX idx_menus_status ON menus(status);
CREATE INDEX idx_menus_parent ON menus(parent_menu_id);
CREATE INDEX idx_menus_created ON menus(created_at DESC);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_menus_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_menus_updated_at ON menus;
CREATE TRIGGER trigger_menus_updated_at
    BEFORE UPDATE ON menus
    FOR EACH ROW
    EXECUTE FUNCTION update_menus_updated_at();

-- 2. SECCIONES DEL MENÚ (Aperitivos, Entrante, Principal, Postre, etc.)
CREATE TABLE IF NOT EXISTS menu_sections (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_id     UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    name        TEXT NOT NULL, -- 'Aperitivos', 'Entrante', 'Principal', 'Postre', 'Recena', 'Bebida'
    position    INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_menu_sections_menu ON menu_sections(menu_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_menu_sections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_menu_sections_updated_at ON menu_sections;
CREATE TRIGGER trigger_menu_sections_updated_at
    BEFORE UPDATE ON menu_sections
    FOR EACH ROW
    EXECUTE FUNCTION update_menu_sections_updated_at();

-- 3. PLATOS POR SECCIÓN (con variantes para dietas)
CREATE TABLE IF NOT EXISTS menu_section_dishes (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    section_id  UUID NOT NULL REFERENCES menu_sections(id) ON DELETE CASCADE,
    dish_id     UUID NOT NULL, -- FK a catalog_items.id (tabla unificada de platos)
    variant_tag TEXT,          -- NULL | 'celiaco' | 'vegetariano' | 'infantil' | 'sin_gluten'
    position    INT NOT NULL DEFAULT 0,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_menu_dishes_section ON menu_section_dishes(section_id);
CREATE INDEX idx_menu_dishes_dish ON menu_section_dishes(dish_id);

-- 4. ASOCIACIÓN EVENTO-MENÚ (versión congelada)
CREATE TABLE IF NOT EXISTS event_menus (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id    UUID NOT NULL, -- FK a events.id (se añade después para evitar circular)
    menu_id     UUID NOT NULL REFERENCES menus(id) ON DELETE RESTRICT, -- No permitir borrar menú vinculado
    pax         INT NOT NULL CHECK (pax > 0),
    price_snapshot NUMERIC(10,2) NOT NULL, -- Precio congelado al momento de vincular
    cost_snapshot  NUMERIC(10,2), -- Coste congelado al momento de vincular
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (event_id, menu_id)
);

CREATE INDEX idx_event_menus_event ON event_menus(event_id);
CREATE INDEX idx_event_menus_menu ON event_menus(menu_id);

-- ============================================================
-- SEED: Menús de ejemplo (solo si la tabla está vacía)
-- ============================================================
DO $$
DECLARE
    v_menu_id UUID;
    v_section_id UUID;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM menus LIMIT 1) THEN
        -- Menú 1: Menú Esencial
        INSERT INTO menus (name, version, status, price_per_pax, description, cost_per_pax, margin_pct)
        VALUES ('Menú Esencial', 1, 'borrador', 75.00, 'Menú completo con entrada, principal y postre', 28.50, 62.00)
        RETURNING id INTO v_menu_id;

        -- Sección: Entrante
        INSERT INTO menu_sections (menu_id, name, position)
        VALUES (v_menu_id, 'Entrante', 1)
        RETURNING id INTO v_section_id;

        INSERT INTO menu_section_dishes (section_id, dish_id, position)
        SELECT v_section_id, id, 1 FROM catalog_items WHERE name = 'Carpaccio de buey' LIMIT 1;

        -- Sección: Principal
        INSERT INTO menu_sections (menu_id, name, position)
        VALUES (v_menu_id, 'Principal', 2)
        RETURNING id INTO v_section_id;

        INSERT INTO menu_section_dishes (section_id, dish_id, position)
        SELECT v_section_id, id, 1 FROM catalog_items WHERE name = 'Solomillo a la plancha' LIMIT 1;

        -- Sección: Postre
        INSERT INTO menu_sections (menu_id, name, position)
        VALUES (v_menu_id, 'Postre', 3)
        RETURNING id INTO v_section_id;

        INSERT INTO menu_section_dishes (section_id, dish_id, position)
        SELECT v_section_id, id, 1 FROM catalog_items WHERE name = 'Tarta de queso' LIMIT 1;

        -- Menú 2: Menú Premium (publicado)
        INSERT INTO menus (name, version, status, price_per_pax, description, cost_per_pax, margin_pct)
        VALUES ('Menú Premium', 1, 'publicado', 110.00, 'Menú premium con 5 pases', 42.00, 61.82)
        RETURNING id INTO v_menu_id;

        -- Sección: Aperitivos
        INSERT INTO menu_sections (menu_id, name, position)
        VALUES (v_menu_id, 'Aperitivos', 1)
        RETURNING id INTO v_section_id;

        INSERT INTO menu_section_dishes (section_id, dish_id, position)
        SELECT v_section_id, id, 1 FROM catalog_items WHERE name = 'Gambas al ajillo' LIMIT 1;

        INSERT INTO menu_section_dishes (section_id, dish_id, position)
        SELECT v_section_id, id, 2 FROM catalog_items WHERE name = 'Pulpo a la gallega' LIMIT 1;

        -- Sección: Principal
        INSERT INTO menu_sections (menu_id, name, position)
        VALUES (v_menu_id, 'Principal', 2)
        RETURNING id INTO v_section_id;

        INSERT INTO menu_section_dishes (section_id, dish_id, position)
        SELECT v_section_id, id, 1 FROM catalog_items WHERE name = 'Rodaballo al horno' LIMIT 1;

        -- Sección: Postre
        INSERT INTO menu_sections (menu_id, name, position)
        VALUES (v_menu_id, 'Postre', 3)
        RETURNING id INTO v_section_id;

        INSERT INTO menu_section_dishes (section_id, dish_id, position)
        SELECT v_section_id, id, 1 FROM catalog_items WHERE name = 'Coulant de chocolate' LIMIT 1;

        RAISE NOTICE 'WP-12: Menús de ejemplo insertados';
    ELSE
        RAISE NOTICE 'WP-12: Tabla menus ya tiene datos, omitiendo seed';
    END IF;
END $$;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT count(*) INTO v_count FROM menus;
    RAISE NOTICE 'WP-12 Verificación: Menús creados = %', v_count;

    SELECT count(*) INTO v_count FROM menu_sections;
    RAISE NOTICE 'WP-12 Verificación: Secciones creadas = %', v_count;

    SELECT count(*) INTO v_count FROM menu_section_dishes;
    RAISE NOTICE 'WP-12 Verificación: Platos en secciones = %', v_count;
END $$;

-- Consulta de verificación final
SELECT 
    (SELECT count(*) FROM menus) as total_menus,
    (SELECT count(*) FROM menus WHERE status = 'publicado') as publicados,
    (SELECT count(*) FROM menu_sections) as total_secciones,
    (SELECT count(*) FROM menu_section_dishes) as total_platos_secciones;
