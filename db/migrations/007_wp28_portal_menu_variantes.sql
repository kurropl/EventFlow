-- ============================================================
-- WP-28: Portal — Menú y Variantes por Invitado
-- Migración 007_wp28_portal_menu_variantes.sql
-- ============================================================
-- Idempotente: usa IF NOT EXISTS
-- Dependencias: WP-12 (menus, menu_sections, menu_section_dishes, event_menus)
--               WP-25 (client_portals — opcional, se usa client_token de events)
-- ============================================================

-- 1. ASEGURAR TABLA event_menus (creada en WP-12, pero puede no estar aplicada)
CREATE TABLE IF NOT EXISTS event_menus (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id        UUID NOT NULL,
    menu_id         UUID NOT NULL REFERENCES menus(id) ON DELETE RESTRICT,
    pax             INT NOT NULL CHECK (pax > 0),
    price_snapshot  NUMERIC(10,2) NOT NULL,
    cost_snapshot   NUMERIC(10,2),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (event_id, menu_id)
);

CREATE INDEX IF NOT EXISTS idx_event_menus_event ON event_menus(event_id);
CREATE INDEX IF NOT EXISTS idx_event_menus_menu ON event_menus(menu_id);

-- 2. TABLA DE VARIANTES POR INVITADO
-- Cada fila = un invitado con una variante de menú asignada
-- Las variantes son: infantil, celiaco, vegetariano, vegano, sin_lactosa, personalizado
CREATE TABLE IF NOT EXISTS event_guest_variants (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    guest_id        UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    event_menu_id   UUID NOT NULL REFERENCES event_menus(id) ON DELETE CASCADE,
    variant_type    TEXT NOT NULL CHECK (variant_type IN (
                        'infantil', 'celiaco', 'vegetariano', 'vegano',
                        'sin_lactosa', 'sin_frutos_secos', 'personalizado'
                    )),
    section_id      UUID REFERENCES menu_sections(id) ON DELETE SET NULL,  -- NULL = aplica a todo el menú
    dish_id         UUID,  -- Plato alternativo asignado (FK a catalog_items, nullable)
    notes           TEXT,  -- Notas adicionales del cliente sobre la variante
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Un invitado solo puede tener una variante por menú del evento
    UNIQUE (guest_id, event_menu_id)
);

CREATE INDEX IF NOT EXISTS idx_guest_variants_event ON event_guest_variants(event_id);
CREATE INDEX IF NOT EXISTS idx_guest_variants_guest ON event_guest_variants(guest_id);
CREATE INDEX IF NOT EXISTS idx_guest_variants_menu ON event_guest_variants(event_menu_id);
CREATE INDEX IF NOT EXISTS idx_guest_variants_type ON event_guest_variants(variant_type);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_guest_variants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_guest_variants_updated_at ON event_guest_variants;
CREATE TRIGGER trigger_guest_variants_updated_at
    BEFORE UPDATE ON event_guest_variants
    FOR EACH ROW
    EXECUTE FUNCTION update_guest_variants_updated_at();

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT count(*) INTO v_count FROM event_guest_variants;
    RAISE NOTICE 'WP-28 Verificación: Variantes de invitados = %', v_count;
END $$;

SELECT
    (SELECT count(*) FROM event_guest_variants) as total_variantes,
    (SELECT count(*) FROM event_menus) as total_event_menus;
