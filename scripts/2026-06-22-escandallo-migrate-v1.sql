-- ============================================================
-- MIGRACIÓN V1: Escandallo como fuente de verdad — columnas
-- ============================================================

-- Añadir versionado a recipe_items
ALTER TABLE recipe_items ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;
ALTER TABLE recipe_items ADD COLUMN IF NOT EXISTS version_note TEXT;
ALTER TABLE recipe_items ADD COLUMN IF NOT EXISTS unit VARCHAR(10) DEFAULT 'g';
ALTER TABLE recipe_items ADD COLUMN IF NOT EXISTS unit_dimension TEXT
    CHECK (unit_dimension IN ('mass','volume','count'));
ALTER TABLE recipe_items ADD COLUMN IF NOT EXISTS quantity_override NUMERIC(10,2);
ALTER TABLE recipe_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE recipe_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Añadir columnas de escandallo teórico/real a event_shopping_items
ALTER TABLE event_shopping_items ADD COLUMN IF NOT EXISTS recipe_item_id UUID REFERENCES recipe_items(id) ON DELETE SET NULL;
ALTER TABLE event_shopping_items ADD COLUMN IF NOT EXISTS recipe_version INT NOT NULL DEFAULT 1;
ALTER TABLE event_shopping_items ADD COLUMN IF NOT EXISTS theoretical_qty NUMERIC(10,2);
ALTER TABLE event_shopping_items ADD COLUMN IF NOT EXISTS theoretical_unit VARCHAR(20);
ALTER TABLE event_shopping_items ADD COLUMN IF NOT EXISTS theoretical_unit_dimension TEXT
    CHECK (theoretical_unit_dimension IN ('mass','volume','count'));
ALTER TABLE event_shopping_items ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(10,2);
ALTER TABLE event_shopping_items ADD COLUMN IF NOT EXISTS actual_cost_total NUMERIC(10,2);
ALTER TABLE event_shopping_items ADD COLUMN IF NOT EXISTS deviation_qty NUMERIC(10,2);
ALTER TABLE event_shopping_items ADD COLUMN IF NOT EXISTS deviation_cost NUMERIC(10,2);
ALTER TABLE event_shopping_items ADD COLUMN IF NOT EXISTS frozen BOOLEAN NOT NULL DEFAULT false;

-- Crear tabla de desviaciones finales del evento
CREATE TABLE IF NOT EXISTS event_cost_deviations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    estimated_total_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    actual_total_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    deviation_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    deviation_pct NUMERIC(5,2),
    closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes TEXT
);

-- Crear tabla de versiones de recetas
CREATE TABLE IF NOT EXISTS recipe_item_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipe_item_id UUID NOT NULL REFERENCES recipe_items(id) ON DELETE CASCADE,
    version INT NOT NULL,
    quantity NUMERIC(10,2) NOT NULL,
    unit VARCHAR(20),
    unit_dimension TEXT,
    changed_by TEXT DEFAULT 'system',
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes TEXT
);

-- ============================================================
-- NOTA: Toda la migración debe ejecutarse en este orden
-- - Primero recipe_items (dependencias)
-- - Luego event_shopping_items (depende de recipe_items)
-- - Por último las tablas de desviaciones y versiones
-- ============================================================

-- Actualizar schema.sql local para reflejar los cambios
-- (se ejecuta después de verificar que todo funciona)