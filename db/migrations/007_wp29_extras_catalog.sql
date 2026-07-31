-- ============================================================
-- Migración 007 — WP-29: Catálogo de Extras y Decoración
-- ============================================================
-- Crea las tablas extras_catalog y event_extras para el
-- catálogo administrable y selección en portal. Añade
-- client_portals (WP-25) como dependencia básica.
-- ============================================================

-- 1. Tabla client_portals (WP-25 dependencia básica)
CREATE TABLE IF NOT EXISTS client_portals (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id        UUID NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
    access_token    TEXT NOT NULL UNIQUE,
    status          TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'congelado', 'cerrado')),
    freeze_date     DATE NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_access_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_client_portals_event ON client_portals(event_id);
CREATE INDEX IF NOT EXISTS idx_client_portals_token ON client_portals(access_token);
ALTER TABLE client_portals DISABLE ROW LEVEL SECURITY;

-- 2. Tabla extras_catalog: catálogo de extras administrable
CREATE TABLE IF NOT EXISTS extras_catalog (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category    TEXT NOT NULL CHECK (category IN ('centro_mesa', 'manteleria', 'minuta', 'flores', 'iluminacion', 'sonido', 'otro')),
    name        TEXT NOT NULL,
    description TEXT,
    photo_url   TEXT,
    price       NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    price_unit  TEXT NOT NULL DEFAULT 'ud' CHECK (price_unit IN ('ud', 'mesa', 'pax', 'evento')),
    active      BOOLEAN NOT NULL DEFAULT true,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_extras_catalog_category ON extras_catalog(category, active);
CREATE INDEX IF NOT EXISTS idx_extras_catalog_active ON extras_catalog(active) WHERE active = true;
ALTER TABLE extras_catalog DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_extras_catalog_updated ON extras_catalog;
CREATE TRIGGER trg_extras_catalog_updated
    BEFORE UPDATE ON extras_catalog
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. Tabla event_extras: extras seleccionados por evento
CREATE TABLE IF NOT EXISTS event_extras (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    extra_id        UUID NOT NULL REFERENCES extras_catalog(id) ON DELETE CASCADE,
    qty             INT NOT NULL DEFAULT 1 CHECK (qty > 0),
    price_snapshot  NUMERIC(10,2) NOT NULL,  -- precio congelado al seleccionar
    unit            TEXT NOT NULL DEFAULT 'ud',  -- snapshot de price_unit
    selected_via    TEXT NOT NULL DEFAULT 'portal' CHECK (selected_via IN ('portal', 'admin')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_extras_event ON event_extras(event_id);
CREATE INDEX IF NOT EXISTS idx_event_extras_extra ON event_extras(extra_id);
-- Un solo registro por extra-evento (qty se actualiza, no se duplica)
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_extras_unique ON event_extras(event_id, extra_id);
ALTER TABLE event_extras DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_event_extras_updated ON event_extras;
CREATE TRIGGER trg_event_extras_updated
    BEFORE UPDATE ON event_extras
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. Configuración de extras en business_settings
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS extras_billing_mode TEXT NOT NULL DEFAULT 'incremento_resto'
    CHECK (extras_billing_mode IN ('incremento_resto', 'hito_extra'));
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS extras_label TEXT NOT NULL DEFAULT 'Extras y decoración';

-- ============================================================
-- Seed data: catálogo inicial de examples
-- ============================================================
INSERT INTO extras_catalog (category, name, description, price, price_unit, sort_order) VALUES
-- Centro de mesa
('centro_mesa', 'Centro de mesa floral', 'Arreglo floral para mesa principal', 45.00, 'mesa', 1),
('centro_mesa', 'Centro de mesa rústico', 'Decoración rústica con flores silvestres', 35.00, 'mesa', 2),
('centro_mesa', 'Centro de mesa minimalista', 'Diseño moderno y limpio', 40.00, 'mesa', 3),
-- Mantelería
('manteleria', 'Mantel blanco premium', 'Mantel de tela blanca premium', 8.00, 'mesa', 10),
('manteleria', 'Camino de mesa', 'Camino decorativo', 5.00, 'mesa', 11),
('manteleria', 'Servilletas de tela', 'Servilletas de tela a juego', 2.00, 'mesa', 12),
-- Minuta
('minuta', 'Menú impreso personalizado', 'Menú diseñado por evento', 3.50, 'pax', 20),
('minuta', 'Tarjeta de nombre', 'Tarjeta con nombre del invitado', 1.50, 'pax', 21),
-- Flores
('flores', 'Ramo de novia', 'Ramo personalizado', 120.00, 'ud', 30),
('flores', 'Corona floral', 'Corona para ceremonia', 85.00, 'ud', 31),
('flores', 'Pétalos sueltos', 'Bolsa de pétalos frescos', 25.00, 'ud', 32),
-- Iluminación
('iluminacion', 'Guirnaldas de luces LED', 'Guirnalda de 3m', 15.00, 'ud', 40),
('iluminacion', 'Velas aromáticas', 'Pack de 6 velas', 12.00, 'ud', 41),
-- Sonido
('sonido', 'Altavoz bluetooth premium', 'Altavoz portátil de alta calidad', 50.00, 'evento', 50),
('sonido', 'Microfono inalámbrico', 'Micrófono para discursos', 30.00, 'evento', 51),
-- Otros
('otro', 'Fotocall personalizado', 'Montaje fotográfico', 150.00, 'evento', 60),
('otro', 'Candy bar', 'Mesa de dulces personalizada', 200.00, 'evento', 61),
('otro', 'Pirotecnia fría', 'Efectos pirotécnicos seguros', 80.00, 'evento', 62)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Verificación
-- ============================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'extras_catalog')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_extras')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_portals')
    THEN
        RAISE NOTICE 'WP-29 OK: extras_catalog, event_extras y client_portals creadas';
    ELSE
        RAISE EXCEPTION 'WP-29 FALLO: una o más tablas no creadas';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_settings' AND column_name = 'extras_billing_mode')
    THEN
        RAISE NOTICE 'WP-29 OK: columnas de configuración de extras en business_settings';
    ELSE
        RAISE EXCEPTION 'WP-29 FALLO: columnas de configuración faltantes';
    END IF;

    IF (SELECT count(*) FROM extras_catalog) >= 15 THEN
        RAISE NOTICE 'WP-29 OK: seed data insertado (% extras)', (SELECT count(*) FROM extras_catalog);
    ELSE
        RAISE WARNING 'WP-29: seed data no insertado o incompleto';
    END IF;
END $$;

-- Verificar contenido
SELECT category, count(*) AS items FROM extras_catalog GROUP BY category ORDER BY category;
SELECT 'event_extras' AS tabla, count(*) AS filas FROM event_extras;
SELECT 'client_portals' AS tabla, count(*) AS filas FROM client_portals;
