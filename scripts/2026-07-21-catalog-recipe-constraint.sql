-- EventFlow — Restricción: todo catalog_item debe tener su receta
-- Se ejecuta DESPUÉS de migrar los datos existentes.

-- 1. Verificar que no hay catalog_items sin receta (warning)
DO $$
DECLARE
  orphan_count INT;
BEGIN
  SELECT count(*) INTO orphan_count FROM catalog_items ci
  WHERE ci.active = true
  AND NOT EXISTS (SELECT 1 FROM recipes r WHERE r.catalog_item_id = ci.id);

  IF orphan_count > 0 THEN
    RAISE WARNING 'Aún hay % catalog_items sin receta. Ejecuta primero la migración.', orphan_count;
  END IF;
END $$;

-- 2. Añadir constraint (inicialmente NO VALID para no bloquear)
ALTER TABLE IF EXISTS catalog_items
  ADD CONSTRAINT fk_catalog_recipe_exists
  FOREIGN KEY (id) REFERENCES recipes(catalog_item_id)
  DEFERRABLE INITIALLY DEFERRED;

-- 3. Para activar la validación completa (cuando no haya huérfanos):
-- ALTER TABLE catalog_items VALIDATE CONSTRAINT fk_catalog_recipe_exists;
