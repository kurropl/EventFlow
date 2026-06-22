-- ============================================================
-- MIGRACIÓN COCINA V1: Pases de servicio, equipamiento, recetas
-- ============================================================

-- 1. service_passes — Pases de servicio por defecto
CREATE TABLE IF NOT EXISTS service_passes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pass_number INT NOT NULL,
    name TEXT NOT NULL,
    icon VARCHAR(10) DEFAULT '🍽️',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO service_passes (pass_number, name, icon, sort_order) VALUES
    (1, 'Aperitivos y entrantes', '🥟', 1),
    (2, 'Mesas y compartidos', '🥘', 2),
    (3, 'Principal', '🥩', 3),
    (4, 'Dulce y final', '🍰', 4),
    (5, 'Bebidas', '🥂', 5),
    (99, 'Complementos', '🧂', 99)
ON CONFLICT DO NOTHING;

-- 2. category_pass_mapping — Mapeo categoría de plato → pase por defecto
CREATE TABLE IF NOT EXISTS category_pass_mapping (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category TEXT NOT NULL UNIQUE,
    pass_id UUID NOT NULL REFERENCES service_passes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO category_pass_mapping (category, pass_id) VALUES
    ('aperitivo-frio',    (SELECT id FROM service_passes WHERE pass_number = 1)),
    ('aperitivo-caliente',(SELECT id FROM service_passes WHERE pass_number = 1)),
    ('compartir-mesa',    (SELECT id FROM service_passes WHERE pass_number = 2)),
    ('arroz',             (SELECT id FROM service_passes WHERE pass_number = 3)),
    ('carne',             (SELECT id FROM service_passes WHERE pass_number = 3)),
    ('pescado',           (SELECT id FROM service_passes WHERE pass_number = 3)),
    ('sorbete',           (SELECT id FROM service_passes WHERE pass_number = 4)),
    ('postre',            (SELECT id FROM service_passes WHERE pass_number = 4)),
    ('bebida',            (SELECT id FROM service_passes WHERE pass_number = 5)),
    ('complemento',       (SELECT id FROM service_passes WHERE pass_number = 99))
ON CONFLICT (category) DO NOTHING;

-- 3. custom_pass_order en events — permite reasignar pases manualmente por evento
ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_pass_order JSONB DEFAULT '[]'::jsonb;

-- 4. equipment — Catálogo de equipamiento con stock
CREATE TABLE IF NOT EXISTS equipment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('utensilio','vajilla','maquinaria','textil','mobiliario','descartable')),
    unit TEXT NOT NULL DEFAULT 'ud',
    stock_quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
    min_stock NUMERIC(10,2) DEFAULT 0,
    notes TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category);
CREATE INDEX IF NOT EXISTS idx_equipment_active ON equipment(active);

-- 5. equipment_rules — Qué equipamiento necesita cada plato/categoría
CREATE TABLE IF NOT EXISTS equipment_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category TEXT,
    catalog_item_id UUID REFERENCES catalog_items(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    quantity_per_use NUMERIC(10,2) NOT NULL DEFAULT 1,
    per_guest BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eq_rules_category ON equipment_rules(category);
CREATE INDEX IF NOT EXISTS idx_eq_rules_catalog ON equipment_rules(catalog_item_id);

-- 6. recipes — Recetas subidas (vinculadas a catálogo)
CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    source TEXT DEFAULT 'manual' CHECK (source IN ('manual','excel','pdf','scanned')),
    source_file TEXT,
    servings INT DEFAULT 1,
    category TEXT,
    catalog_item_id UUID REFERENCES catalog_items(id) ON DELETE SET NULL,
    published BOOLEAN NOT NULL DEFAULT false,
    ingredients JSONB DEFAULT '[]'::jsonb,
    instructions TEXT,
    prep_time INT,
    cook_time INT,
    difficulty TEXT DEFAULT 'media' CHECK (difficulty IN ('facil','media','dificil')),
    version INT NOT NULL DEFAULT 1,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recipes_name ON recipes(name);
CREATE INDEX IF NOT EXISTS idx_recipes_active ON recipes(active);
CREATE INDEX IF NOT EXISTS idx_recipes_catalog ON recipes(catalog_item_id);

-- 7. Trigger updated_at para equipment
CREATE OR REPLACE FUNCTION update_equipment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_equipment_updated
    BEFORE UPDATE ON equipment
    FOR EACH ROW EXECUTE FUNCTION update_equipment_timestamp();

-- 8. Trigger updated_at para recipes
CREATE OR REPLACE FUNCTION update_recipes_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recipes_updated
    BEFORE UPDATE ON recipes
    FOR EACH ROW EXECUTE FUNCTION update_recipes_timestamp();