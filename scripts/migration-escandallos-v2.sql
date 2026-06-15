-- ============================================================
-- SPRINT E1-E5: Escandallos avanzados
-- Ejecutar: psql -U postgres -d eventflow -f scripts/migration-escandallos-v2.sql
-- ============================================================

-- ── E1: Recipe Templates ───────────────────────────────────
CREATE TABLE IF NOT EXISTS recipe_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'general',  -- boda, corporativo, bautizo, comunión, cumple, general
  base_pax INTEGER NOT NULL DEFAULT 50,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipe_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipe_templates(id) ON DELETE CASCADE,
  ingredient_name VARCHAR(200) NOT NULL,
  quantity_per_pax NUMERIC(10,3) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL DEFAULT 'g',  -- g, ml, ud
  provider_name VARCHAR(200),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipe_template_items_recipe ON recipe_template_items(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_templates_category ON recipe_templates(category);

-- ── E2: Coste Real vs Estimado ─────────────────────────────
ALTER TABLE event_shopping_items ADD COLUMN IF NOT EXISTS actual_quantity NUMERIC(10,3);
ALTER TABLE event_shopping_items ADD COLUMN IF NOT EXISTS actual_unit VARCHAR(20);
ALTER TABLE event_shopping_items ADD COLUMN IF NOT EXISTS actual_cost NUMERIC(10,2);
ALTER TABLE event_shopping_items ADD COLUMN IF NOT EXISTS cost_per_unit NUMERIC(10,4);
ALTER TABLE event_shopping_items ADD COLUMN IF NOT EXISTS notes TEXT;

-- Backfill cost_per_unit from ingredients table
UPDATE event_shopping_items esi
SET cost_per_unit = i.cost_per_unit
FROM ingredients i
WHERE esi.ingredient_name ILIKE i.name AND esi.cost_per_unit IS NULL;

-- ── E3: Historial de Precios ───────────────────────────────
CREATE TABLE IF NOT EXISTS ingredient_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  old_price NUMERIC(10,4),
  new_price NUMERIC(10,4) NOT NULL,
  changed_by VARCHAR(100) DEFAULT 'system',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_history_ingredient ON ingredient_price_history(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_price_history_date ON ingredient_price_history(recorded_at DESC);

-- ── E5: Unidades de Medida ─────────────────────────────────
CREATE TABLE IF NOT EXISTS units_of_measure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(20) NOT NULL UNIQUE,
  category VARCHAR(20) NOT NULL,  -- weight, volume, unit
  factor_to_base NUMERIC(10,4) NOT NULL DEFAULT 1,
  -- weight: kg=1, g=0.001
  -- volume: l=1, ml=0.001
  -- unit: ud=1
  symbol VARCHAR(10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO units_of_measure (name, category, factor_to_base, symbol) VALUES
  ('kg', 'weight', 1, 'kg'),
  ('g', 'weight', 0.001, 'g'),
  ('l', 'volume', 1, 'L'),
  ('ml', 'volume', 0.001, 'ml'),
  ('ud', 'unit', 1, 'ud')
ON CONFLICT (name) DO NOTHING;

-- ── Helper: convert between units ──────────────────────────
CREATE OR REPLACE FUNCTION convert_uom(amount NUMERIC, from_unit VARCHAR, to_unit VARCHAR)
RETURNS NUMERIC AS $$
DECLARE
  from_factor NUMERIC;
  to_factor NUMERIC;
BEGIN
  SELECT factor_to_base INTO from_factor FROM units_of_measure WHERE name = from_unit;
  SELECT factor_to_base INTO to_factor FROM units_of_measure WHERE name = to_unit;
  IF from_factor IS NULL OR to_factor IS NULL THEN RETURN amount; END IF;
  RETURN ROUND((amount * from_factor / to_factor)::numeric, 4);
END;
$$ LANGUAGE plpgsql IMMUTABLE;
