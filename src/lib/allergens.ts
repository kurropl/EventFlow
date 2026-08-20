/**
 * EventFlow — M5: Alérgenos derivados automáticamente de ingredientes
 *
 * Al leer un ingrediente, si no tiene allergens explícitos en ingredients,
 * se derivan automáticamente desde catalog_items (que tiene el mapeo
 * de alérgenos por producto).
 *
 * También se expone en la ficha de receta un campo `allergens_derivados`
 * que es la unión de los alérgenos de todos sus ingredientes.
 */
import { getPool } from '@/lib/db';

/**
 * Alérgenos por nombre de ingrediente (heurística):
 * Se usa cuando el ingrediente no tiene allergens explícitos en ingredients ni catalog_items.
 */
const ALLERGEN_MAP: Record<string, string[]> = {
  lacteo: ['lactosa'],
  leche: ['lactosa'],
  mantequilla: ['lactosa'],
  queso: ['lactosa'],
  yogur: ['lactosa'],
  crema: ['lactosa'],
  trigo: ['gluten'],
  harina: ['gluten'],
  centeno: ['gluten'],
  cebada: ['gluten'],
  avena: ['gluten'],
  huevo: ['huevo'],
  yema: ['huevo'],
  clara: ['huevo'],
  merengue: ['huevo'],
  almendra: ['frutos_secos'],
  nuez: ['frutos_secos'],
  pistacho: ['frutos_secos'],
  avellana: ['frutos_secos'],
  cacahuete: ['frutos_secos'],
  soja: ['soja'],
  tofu: ['soja'],
  tempeh: ['soja'],
  pescado: ['pescado'],
  marisco: ['marisco'],
  gamba: ['marisco'],
  langostino: ['marisco'],
  mejillon: ['marisco'],
  berberecho: ['marisco'],
  crustaceo: ['marisco'],
  sulfito: ['sulfitos'],
  aipo: ['apio'],
  sésamo: ['sesamo'],
  mostaza: ['mostaza'],
};

export function getAllergensFromName(ingredientName: string): string[] {
  const lower = ingredientName.toLowerCase();
  const found: string[] = [];
  for (const [key, allergens] of Object.entries(ALLERGEN_MAP)) {
    if (lower.includes(key)) {
      found.push(...allergens);
    }
  }
  // Deduplicar
  return [...new Set(found)];
}

/**
 * Resuelve los alérgenos de un ingrediente:
 * 1. ingredients.allergens (si existe)
 * 2. catalog_items.allergens (si está vinculado)
 * 3. Heurística por nombre
 *
 * @param ingredientId - ID del ingrediente
 * @returns array de alérgenos únicos
 */
export async function resolveIngredientAllergens(ingredientId: string): Promise<string[]> {
  const pool = getPool();

  // 1. Leer ingredientes.allergens
  const ingRes = await pool.query(
    'SELECT name, allergens FROM ingredients WHERE id = $1',
    [ingredientId]
  );
  if (ingRes.rows.length === 0) return [];
  const ing = ingRes.rows[0];

  // Si tiene allergens explícitos en ingredients, usarlos
  if (ing.allergens) {
    try {
      const allergens = typeof ing.allergens === 'string' ? JSON.parse(ing.allergens) : ing.allergens;
      if (Array.isArray(allergens) && allergens.length > 0) {
        return [...new Set(allergens)];
      }
    } catch {
      // JSON parse error → ignorar
    }
  }

  // 2. Leer catalog_items.allergens
  try {
    const catRes = await pool.query(
      'SELECT allergens FROM catalog_items WHERE id = $1',
      [ingredientId] // muchos ID de ingredientes también existen en catalog_items
    );
    if (catRes.rows.length > 0 && catRes.rows[0].allergens) {
      try {
        const allergens = typeof catRes.rows[0].allergens === 'string' ? JSON.parse(catRes.rows[0].allergens) : catRes.rows[0].allergens;
        if (Array.isArray(allergens) && allergens.length > 0) {
          return [...new Set(allergens)];
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // catalog_items puede no tener allergens column — ignorar
  }

  // 3. Heurística por nombre
  return getAllergensFromName(ing.name);
}

/**
 * Calcula los alérgenos derivados de una receta (unión de todos sus ingredientes).
 * @param recipeId - ID de la receta
 * @returns { string[], manual: string[] }
 */
export async function getRecipeAllergensDerived(recipeId: string): Promise<{
  alergenos: string[];
  manual: string[];
}> {
  const pool = getPool();

  // Alérgenos manuales de la receta
  const recipeRes = await pool.query(
    'SELECT allergens FROM recipes WHERE id = $1',
    [recipeId]
  );
  let manual: string[] = [];
  if (recipeRes.rows[0]?.allergens) {
    try {
      manual = typeof recipeRes.rows[0].allergens === 'string' ? JSON.parse(recipeRes.rows[0].allergens) : recipeRes.rows[0].allergens;
      if (!Array.isArray(manual)) manual = [];
    } catch {
      manual = [];
    }
  }

  // Alérgenos de todos los ingredientes (incluyendo sub-recetas)
  const lines = await pool.query(
    `SELECT i.name, ri.ingredient_id, ri.subrecipe_id
       FROM recipe_ingredients ri
       LEFT JOIN ingredients i ON i.id = ri.ingredient_id
      WHERE ri.recipe_id = $1`,
    [recipeId]
  );

  const allAllergens: string[] = [...new Set(manual)];

  for (const line of lines.rows) {
    if (line.subrecipe_id) {
      // Recursivamente obtener alérgenos de la sub-receta
      const sub = await getRecipeAllergensDerived(line.subrecipe_id);
      allAllergens.push(...sub.alergenos);
    } else if (line.ingredient_id) {
      const allergens = await resolveIngredientAllergens(line.ingredient_id);
      allAllergens.push(...allergens);
    }
  }

  return {
    alergenos: [...new Set(allAllergens)],
    manual: [...new Set(manual)],
  };
}