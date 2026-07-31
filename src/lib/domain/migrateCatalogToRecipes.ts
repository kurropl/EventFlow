/**
 * EventFlow — Migración: Crear recetas desde catalog_items
 *
 * Lee todos los catalog_items activos y para cada uno:
 * 1. Crea/encuentra los ingredientes en la tabla `ingredients`
 * 2. Crea una receta en `recipes`
 * 3. Crea las líneas en `recipe_ingredients`
 *
 * Los items SIN ingredientes (complementos, bebidas genéricas) se crean
 * como recetas "placeholder" sin ingredientes.
 */
import { querySingle, queryMany, transaction } from '@/lib/db';

interface CatalogIngredient {
  name?: string;
  count?: number;
  grams?: number;
  ml?: number;
}

interface CatalogItem {
  id: string;
  name: string;
  category: string;
  pvp: string;
  cost: string;
  ingredients: CatalogIngredient[];
  allergens: string[];
}

export async function migrateCatalogToRecipes(): Promise<{ created: number; skipped: number; errors: string[] }> {
  const items = await queryMany<CatalogItem>(
    `SELECT id, name, category, pvp, cost, ingredients, COALESCE(allergens, '[]'::jsonb) as allergens
     FROM catalog_items WHERE active = true
     AND id NOT IN (SELECT catalog_item_id FROM recipes WHERE catalog_item_id IS NOT NULL)
     ORDER BY name`
  );

  const errors: string[] = [];
  let created = 0;
  let skipped = 0;

  for (const item of items) {
    try {
      await transaction(async (client) => {
        const ingredients = (item.ingredients || []) as CatalogIngredient[];
        const allergens = (item.allergens || []) as string[];

        // 1. Create the recipe
        const recipeRes = await client.query(
          `INSERT INTO recipes (name, category, description, instructions, allergens, merma_pct, servings, published, active, catalog_item_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 0.2, 1, true, true, $6, NOW(), NOW()) RETURNING id`,
          [
            item.name,
            item.category,
            `Receta generada desde catálogo. PVP: ${item.pvp}€`,
            '',
            JSON.stringify(allergens),
            item.id,
          ]
        );
        const recipeId = recipeRes.rows[0].id;

        // 2. Process each ingredient
        let totalCost = 0;
        for (const ing of ingredients) {
          const ingName = ing.name || 'desconocido';
          const quantity = ing.grams || ing.count || ing.ml || 1;
          const unit = ing.grams ? 'g' : ing.ml ? 'ml' : 'ud';

          // Find or create ingredient
          let ingResult = await client.query(
            'SELECT id, unit_cost FROM ingredients WHERE LOWER(name) = LOWER($1) LIMIT 1',
            [ingName]
          );

          let ingredientId: string;
          let unitCost = 0;

          if (ingResult.rows.length > 0) {
            ingredientId = ingResult.rows[0].id;
            unitCost = Number(ingResult.rows[0].unit_cost) || 0;
          } else {
            // Estimate cost based on PVP/cost of the recipe
            unitCost = Number(item.cost) > 0 && ingredients.length > 0
              ? (Number(item.cost) / ingredients.length) / quantity
              : 0;

            const newIng = await client.query(
              `INSERT INTO ingredients (name, unit_cost, cost_per_unit, unit, active, created_at, updated_at)
               VALUES ($1, $2, $2, $3, true, NOW(), NOW()) RETURNING id`,
              [ingName, unitCost, unit]
            );
            ingredientId = newIng.rows[0].id;
          }

          // Create recipe_ingredient
          const lineCost = quantity * unitCost;
          totalCost += lineCost;

          await client.query(
            `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, cost, per_guest)
             VALUES ($1, $2, $3, $4, $5, true)`,
            [recipeId, ingredientId, quantity, unit, lineCost]
          );
        }

        // 3. Update cost_per_serving
        const servings = Number(item.cost) > 0 ? Number(item.cost) : (totalCost || 0.01);
        await client.query(
          'UPDATE recipes SET cost_per_serving = $1, updated_at = NOW() WHERE id = $2',
          [totalCost, recipeId]
        );
      });

      created++;
    } catch (err: any) {
      errors.push(`${item.name}: ${err.message}`);
      skipped++;
    }
  }

  return { created, skipped, errors };
}

// Ejecutar si se llama directamente
// migrateCatalogToRecipes().then(r => console.log(r)).catch(e => console.error(e));