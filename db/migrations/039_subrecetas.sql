-- WP-M2: Sub-recetas / Elaboraciones intermedias
-- Una receta puede usar OTRA receta como ingrediente compuesto (ej: pasta base → pasta al pesto).

-- 1. Añadir columna para sub-receta en recipe_ingredients
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'recipe_ingredients' AND column_name = 'subrecipe_id') THEN
    ALTER TABLE recipe_ingredients ADD COLUMN subrecipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL;
    COMMENT ON COLUMN recipe_ingredients.subrecipe_id IS 'ID de sub-receta (elaboración intermedia) si esta línea es un ingrediente compuesto.';
  END IF;
END $$;

-- 2. Crear índice para búsqueda rápida de sub-recetas por parent
CREATE INDEX IF NOT EXISTS idx_ri_subrecipe ON recipe_ingredients(subrecipe_id);

-- 3. Comprobar que las recetas existentes no tienen subrecipe_id circular
-- (No se fuerza FK circular, solo se permite subrecipe_id cuando la línea no tiene un ingrediente_id directo)
COMMENT ON TABLE recipe_ingredients IS 'Items de receta. WP-M2: subrecipe_id permite usar otra receta como ingrediente compuesto.';