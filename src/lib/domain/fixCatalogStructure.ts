/**
 * EventFlow — Fix: Limpiar productos simples, estimar costes, preparar precios variables
 *
 * 1. Elimina recetas de productos que no requieren elaboración (agua, pan, servicios...)
 * 2. Marca catalog_items como 'simple' vs 'elaborado'
 * 3. Estima costes de ingredientes que tienen coste 0
 * 4. Crea estructura para precio histórico de ingredientes
 */
import { queryMany, querySingle, transaction } from '@/lib/db';

const SIMPLE_PRODUCT_NAMES = [
  'Agua', 'Pan individual', 'Cava', 'Cerveza', 'Refrescos', 'Vino tinto',
  'Vino blanco', 'Manzanilla', 'Frizzante', 'Verdejo', 'Queso',
  'Cania de lomo', 'Gorditas del sur', 'Papas alinas', 'Papas aliñás',
  'Frito variado', 'Postre del dia', 'Gambas cocidas',
  'Barbacoa en directo', 'Buffet de tartas', 'Cortador de jamón',
  'El rincón del vegano', 'Estación de agua', 'Estación de ahumados',
  'Estación de arroces', 'Estación de buñuelos', 'Estación de cervezas',
  'Estación de chacina', 'Estación de cócteles', 'Estación de fritos',
  'Estación de mariscos', 'Estación de salmorejos', 'Estación de sushi',
  'Estación de vermut', 'Estación mexicana', 'Estación raw bar',
  'Food truck', 'Hora loca', 'Mesa de chuches', 'Planeta helado',
  'Show cooking de ostras', 'Solomillo al PX',
  'Carrillera a baja temperatura con pure trufado',
  'Merluza gratinada con crema de ajo asado y salsa rotena',
  'PASTA ESPEJO', // Keep recipe but ensure it has cost
  'Verdejo y Frizzante',
];

export async function fixCatalogStructure() {
  const results = { deletedRecipes: 0, estimatedCosts: 0, errors: [] as string[] };

  try {
    // 1. Add type column to catalog_items if not exists
    await querySingle('ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT \'elaborado\' CHECK (item_type IN (\'elaborado\', \'simple\'))');

    // 2. Find and delete recipes for simple products that have no ingredients
    const simpleRecipes = await queryMany<{ id: string; name: string; catalog_item_id: string }>(
      `SELECT r.id, r.name, r.catalog_item_id FROM recipes r
       WHERE r.catalog_item_id IS NOT NULL
       AND (
         LOWER(r.name) LIKE ANY($1)
         OR NOT EXISTS (SELECT 1 FROM recipe_ingredients WHERE recipe_id = r.id)
       )
       AND r.catalog_item_id NOT IN (
         SELECT catalog_item_id FROM recipes WHERE catalog_item_id IS NOT NULL
         AND id IN (SELECT recipe_id FROM recipe_ingredients LIMIT 1)
       )`,
      [SIMPLE_PRODUCT_NAMES.map(n => `%${n.toLowerCase()}%`)]
    );

    for (const recipe of simpleRecipes) {
      try {
        await transaction(async (client) => {
          // Delete recipe_ingredients first
          await client.query('DELETE FROM recipe_ingredients WHERE recipe_id = $1', [recipe.id]);
          // Delete recipe
          await client.query('DELETE FROM recipes WHERE id = $1', [recipe.id]);
          // Mark catalog_item as simple
          if (recipe.catalog_item_id) {
            await client.query('UPDATE catalog_items SET item_type = \'simple\' WHERE id = $1', [recipe.catalog_item_id]);
          }
        });
        results.deletedRecipes++;
      } catch (err: any) {
        results.errors.push(`Error deleting ${recipe.name}: ${err.message}`);
      }
    }

    // 3. Mark catalog_items that have no recipe as simple
    await querySingle(
      `UPDATE catalog_items SET item_type = 'simple'
       WHERE item_type = 'elaborado'
       AND id NOT IN (SELECT catalog_item_id FROM recipes WHERE catalog_item_id IS NOT NULL)`
    );

    // 4. Estimate costs for ingredients that have 0 cost
    const zeroCostIngredients = await queryMany<{ id: string; name: string }>(
      `SELECT id, name FROM ingredients WHERE unit_cost = 0 OR unit_cost IS NULL`
    );

    for (const ing of zeroCostIngredients) {
      // Estimate cost based on recipe_ingredients average or set a default
      const recipeCost = await querySingle<{ avg_cost: number }>(
        `SELECT AVG(cost / NULLIF(quantity, 0)) as avg_cost
         FROM recipe_ingredients WHERE ingredient_id = $1 AND cost > 0`,
        [ing.id]
      );

      const estimatedCost = recipeCost?.avg_cost || 0.01; // Minimum 1 cent
      await querySingle(
        'UPDATE ingredients SET unit_cost = $1, cost_per_unit = $1 WHERE id = $2',
        [estimatedCost, ing.id]
      );
      results.estimatedCosts++;
    }

    // 5. Create price_history table if not exists
    await querySingle(`
      CREATE TABLE IF NOT EXISTS ingredient_price_history (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
        purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
        unit_cost NUMERIC(12,4) NOT NULL,
        quantity NUMERIC(12,4) NOT NULL DEFAULT 1,
        supplier TEXT,
        invoice_ref TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);

    await querySingle(`
      CREATE INDEX IF NOT EXISTS idx_ingredient_price_history_ingredient
      ON ingredient_price_history(ingredient_id, purchase_date DESC)`);

  } catch (err: any) {
    results.errors.push(`Global error: ${err.message}`);
  }

  return results;
}

export async function updateIngredientCost(ingredientId: string, newCost: number, supplier?: string) {
  return transaction(async (client) => {
    // Record price history
    await client.query(
      `INSERT INTO ingredient_price_history (ingredient_id, purchase_date, unit_cost, quantity, supplier)
       VALUES ($1, CURRENT_DATE, $2, 1, $3)`,
      [ingredientId, newCost, supplier || null]
    );

    // Update current cost
    await client.query(
      'UPDATE ingredients SET unit_cost = $1, cost_per_unit = $1, updated_at = NOW() WHERE id = $2',
      [newCost, ingredientId]
    );

    // Update all recipe_ingredients that use this ingredient
    await client.query(
      `UPDATE recipe_ingredients ri
       SET cost = ri.quantity * $1
       WHERE ri.ingredient_id = $2`,
      [newCost, ingredientId]
    );
  });
}