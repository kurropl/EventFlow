-- ============================================================
-- WP-11: Unificación Platos/Recetas
-- Fecha: 2026-07-30
--
-- Objetivo: Una sola entidad plato/receta canónica (catalog_items)
-- con columnas de ambas tablas, backfill por matching de nombre,
-- VISTA SQL v_recipes para no romper lecturas legacy, y
-- redirección de escrituras.
--
-- DECISIÓN DE MAPEO: catalog_items es la tabla canónica porque
-- recipe_items tiene FK → catalog_items. No podemos cambiar esa FK
-- sin violar NR-1. La tabla recipes se mantiene pero se marca
-- DEPRECATED; se crea la VIEW v_recipes que expone el esquema
-- antiguo leyendo de catalog_items.
-- ============================================================

-- ============================================================
-- 1. Añadir columnas de recipes a catalog_items (las que faltan)
-- ============================================================

-- Campos técnicos de cocina
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual' CHECK (source IN ('manual','excel','pdf','scanned'));
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS source_file TEXT;
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS servings INT DEFAULT 1;
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS instructions TEXT;
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS prep_time INT;
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS cook_time INT;
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'media' CHECK (difficulty IN ('facil','media','dificil'));
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT false;

-- Ficha técnica
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS merma_pct NUMERIC(5,2) NOT NULL DEFAULT 20;
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS peso_racion NUMERIC(12,3);
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS author TEXT;
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Comentarios de deprecación para la tabla recipes
COMMENT ON TABLE recipes IS 'DEPRECATED(2026-07-30, WP-11): Tabla legacy subsumida en catalog_items. No usar para escrituras nuevas. Mantener para compatibilidad temporal.';
COMMENT ON COLUMN recipes.catalog_item_id IS 'DEPRECATED(2026-07-30, WP-11): FK a la tabla unificada catalog_items. Todas las columnas de recipes ahora viven en catalog_items.';

-- ============================================================
-- 2. Backfill: copiar datos de recipes → catalog_items
--    Solo para filas donde recipes tiene datos que catalog_items no tiene
-- ============================================================

-- Backfill de metadatos técnicos desde recipes → catalog_items
UPDATE catalog_items ci
SET
  source      = COALESCE(r.source, ci.source, 'manual'),
  servings    = COALESCE(r.servings, ci.servings, 1),
  instructions = COALESCE(r.instructions, ci.instructions),
  prep_time   = COALESCE(r.prep_time, ci.prep_time),
  cook_time   = COALESCE(r.cook_time, ci.cook_time),
  difficulty  = COALESCE(r.difficulty, ci.difficulty, 'media'),
  version     = GREATEST(COALESCE(r.version, 1), ci.version),
  published   = COALESCE(r.published, ci.published, false),
  merma_pct   = COALESCE(r.merma_pct, ci.merma_pct, 20),
  peso_racion = COALESCE(r.peso_racion, ci.peso_racion),
  author      = COALESCE(r.author, ci.author),
  photo_url   = COALESCE(r.photo_url, ci.photo_url)
FROM recipes r
WHERE r.catalog_item_id = ci.id
  AND (
    r.source IS NOT NULL OR
    r.servings IS NOT NULL OR
    r.instructions IS NOT NULL OR
    r.prep_time IS NOT NULL OR
    r.cook_time IS NOT NULL OR
    r.difficulty IS NOT NULL OR
    r.published = true OR
    r.merma_pct != 20 OR
    r.peso_racion IS NOT NULL OR
    r.author IS NOT NULL OR
    r.photo_url IS NOT NULL
  );

-- Sincronizar allergens: si recipes.allergens (TEXT) tiene datos y catalog_items.allergens (JSONB) está vacío
UPDATE catalog_items ci
SET allergens = to_jsonb(string_to_array(r.allergens, ','))
FROM recipes r
WHERE r.catalog_item_id = ci.id
  AND r.allergens IS NOT NULL
  AND r.allergens != ''
  AND (ci.allergens IS NULL OR ci.allergens = '[]'::jsonb);

-- ============================================================
-- 3. Crear catálogo items para recetas que NO tienen link
--    (recipes sin catalog_item_id) - matching por nombre normalizado
-- ============================================================

-- Crear catalog_items para recetas huérfanas por matching de nombre
INSERT INTO catalog_items (name, category, active, pvp, cost, ingredients,
  source, servings, instructions, prep_time, cook_time, difficulty,
  published, version, merma_pct, peso_racion, author, photo_url)
SELECT
  r.name,
  COALESCE(r.category, 'complemento') AS category,
  COALESCE(r.active, true) AS active,
  0 AS pvp,
  0 AS cost,
  COALESCE(r.ingredients, '[]'::jsonb) AS ingredients,
  COALESCE(r.source, 'manual'),
  COALESCE(r.servings, 1),
  r.instructions,
  r.prep_time,
  r.cook_time,
  COALESCE(r.difficulty, 'media'),
  COALESCE(r.published, false),
  COALESCE(r.version, 1),
  COALESCE(r.merma_pct, 20),
  r.peso_racion,
  r.author,
  r.photo_url
FROM recipes r
WHERE r.catalog_item_id IS NULL
  AND r.active = true
  AND NOT EXISTS (
    SELECT 1 FROM catalog_items ci
    WHERE LOWER(TRIM(ci.name)) = LOWER(TRIM(r.name))
  );

-- Linkar las recetas huérfanas recién creadas
UPDATE recipes r
SET catalog_item_id = ci.id
FROM catalog_items ci
WHERE r.catalog_item_id IS NULL
  AND LOWER(TRIM(ci.name)) = LOWER(TRIM(r.name));

-- ============================================================
-- 4. Backfill adicional: para recetas que SÍ tienen link pero
--    la categoría en catalog_items es genérica, refinarla
-- ============================================================

UPDATE catalog_items ci
SET category = COALESCE(r.category, ci.category)
FROM recipes r
WHERE r.catalog_item_id = ci.id
  AND r.category IS NOT NULL
  AND ci.category = 'complemento'
  AND r.category != 'complemento';

-- ============================================================
-- 5. Crear VIEW v_recipes como fachada de catalog_items
--    con el esquema exacto de la tabla recipes legacy
-- ============================================================

CREATE OR REPLACE VIEW v_recipes AS
SELECT
  ci.id,
  ci.name,
  ci.description,
  ci.source,
  ci.source_file,
  ci.servings,
  ci.category,
  ci.id AS catalog_item_id,  -- siempre tiene catálogo ahora
  ci.published,
  ci.ingredients,
  ci.instructions,
  ci.prep_time,
  ci.cook_time,
  ci.difficulty,
  ci.version,
  ci.active,
  ci.created_at,
  ci.updated_at,
  ci.merma_pct,
  ci.peso_racion,
  ci.author,
  ci.allergens::text AS allergens,  -- JSONB → text para compatibilidad
  ci.photo_url
FROM catalog_items ci;

-- ============================================================
-- 6. Crear vista de resumen unificada (Sala + Cocina)
-- ============================================================

CREATE OR REPLACE VIEW v_dishes_unified AS
SELECT
  ci.id,
  ci.name,
  ci.category,
  ci.subcategory,
  ci.pvp,
  ci.cost,
  ci.ingredients,
  ci.image_url,
  ci.active,
  ci.allergens,
  ci.description,
  ci.source,
  ci.servings,
  ci.instructions,
  ci.prep_time,
  ci.cook_time,
  ci.difficulty,
  ci.published,
  ci.version,
  ci.merma_pct,
  ci.peso_racion,
  ci.author,
  ci.photo_url,
  -- Conteo de ingredientes normalizados
  (SELECT count(*) FROM recipe_items ri WHERE ri.catalog_item_id = ci.id) AS ingredient_count,
  -- Margen calculado
  CASE WHEN ci.pvp > 0 THEN ROUND(((ci.pvp - ci.cost) / ci.pvp * 100)::numeric, 1) ELSE 0 END AS margin_pct
FROM catalog_items ci
WHERE ci.active = true;

-- ============================================================
-- 7. Verificación de la migración
-- ============================================================

-- Verificar que todas las columnas existen
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM information_schema.columns
          WHERE table_name = 'catalog_items' AND column_name IN (
            'source', 'servings', 'instructions', 'prep_time', 'cook_time',
            'difficulty', 'version', 'published', 'merma_pct', 'peso_racion',
            'author', 'photo_url'
          )) = 12,
    'Faltan columnas en catalog_items después de la migración WP-11';
END $$;

-- Verificar que la vista v_recipes existe
DO $$
BEGIN
  ASSERT EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_recipes'),
    'La vista v_recipes no se creó correctamente';
END $$;

-- Verificar que la vista v_dishes_unified existe
DO $$
BEGIN
  ASSERT EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_dishes_unified'),
    'La vista v_dishes_unified no se creó correctamente';
END $$;

-- Conteo de verificación
SELECT
  (SELECT count(*) FROM catalog_items WHERE active = true) AS catalog_items_activos,
  (SELECT count(*) FROM recipes WHERE active = true) AS recipes_activas,
  (SELECT count(*) FROM catalog_items ci
   WHERE EXISTS (SELECT 1 FROM recipe_items ri WHERE ri.catalog_item_id = ci.id)
  ) AS dishes_con_ingredientes,
  (SELECT count(*) FROM v_recipes WHERE active = true) AS v_recipes_activos;

-- ============================================================
-- FIN MIGRACIÓN WP-11
-- ============================================================
