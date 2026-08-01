/**
 * EventFlow — Servicio de Importación de Recetas desde Excel
 *
 * Lee el archivo Excel con formato de ficha técnica y crea/actualiza
 * la receta en recipes + recipe_ingredients.
 *
 * Formato esperado (PLANTILLA FICHA TECNICA AUTOMATIZADA.xlsx):
 *   Fila 2:  Nombre de la receta (col B)
 *   Fila 5:  Peso total/pax, Autor
 *   Fila 7:  Cabeceras: CANTIDAD | MEDIDA | INGREDIENTE | PRECIO UNITARIO | PRECIO TOTAL
 *   Filas 8-20: Datos de ingredientes
 *   Fila 21: Alérgenos
 *   Fila 24: % Merma (default 0.2 = 20%)
 */

import * as XLSX from 'xlsx';
import { querySingle, queryMany, transaction } from '@/lib/db';

export interface RecipeImportResult {
  success: boolean;
  recipeName: string;
  recipeId: string | null;
  ingredientsImported: number;
  ingredientsSkipped: string[];
  allergens: string[];
  mermaPct: number;
  error?: string;
}

export interface ExcelRecipeData {
  name: string;
  category: string;
  author: string;
  ingredients: Array<{
    name: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
  }>;
  allergens: string[];
  mermaPct: number;
  totalCost: number;
  costPerServing: number;
  instructions: string;
}

/**
 * Parsea el archivo Excel y extrae los datos de la receta
 */
export function parseRecipeExcel(fileBuffer: Buffer): ExcelRecipeData {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  // Buscar nombre de receta (fila 2, col B = index 1)
  let recipeName = '';
  let author = '';
  let mermaPct = 0.2;
  const ingredients: ExcelRecipeData['ingredients'] = [];
  const allergens: string[] = [];

  let instructionsLines: string[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];

    // Fila 2 (index 1): Nombre de receta en col B (col 0 en sheet_to_json)
    if (i === 1 && row[0]) {
      recipeName = String(row[0]).trim();
    }

    // Filas 3-4 (index 2-3): Instrucciones de elaboración en col H (index 6)
    if (i >= 2 && i <= 3 && row[6]) {
      const instr = String(row[6]).trim();
      if (instr && instr !== 'ELABORACIÓN') {
        instructionsLines.push(instr);
      }
    }

    // Fila 5 (index 4): Autor en col E (col 3)
    if (i === 4 && row[3]) {
      const autorRaw = String(row[3]).trim();
      if (autorRaw && autorRaw !== 'AUTOR :' && autorRaw !== '    AUTOR : ') {
        author = autorRaw;
      }
    }

    // Filas 7-19 (index 6-18): Ingredientes
    // Columnas en sheet_to_json: B=0, C=1, D=2, E=3, F=4
    if (i >= 6 && i <= 18) {
      const cantidad = Number(row[0]) || 0;  // Col B
      const medida = row[1] ? String(row[1]).trim().toLowerCase() : '';  // Col C
      const ingrediente = row[2] ? String(row[2]).trim() : '';  // Col D
      const precioUnitario = Number(row[3]) || 0;  // Col E

      if (cantidad > 0 && ingrediente) {
        let unit = medida;
        if (unit === 'gr' || unit === 'grs' || unit === 'gramos') unit = 'g';
        else if (unit === 'kg' || unit === 'kilos') unit = 'kg';
        else if (unit === 'ml' || unit === 'mililitros') unit = 'ml';
        else if (unit === 'l' || unit === 'litros') unit = 'l';
        else if (unit === 'ud' || unit === 'unidades' || unit === 'und' || unit === 'uds') unit = 'ud';
        else if (unit === 'doc' || unit === 'docena' || unit === 'docenas') unit = 'doc';
        else if (!unit) unit = 'ud';

        ingredients.push({
          name: ingrediente,
          quantity: cantidad,
          unit,
          unitPrice: precioUnitario,
          totalPrice: cantidad * precioUnitario,
        });
      }
    }

    // Alérgenos: col I (index 7) en las filas 21-24
    // Cada fila puede tener un alérgeno diferente
    if (i >= 20 && i <= 23 && row[7]) {
      const al = String(row[7]).trim();
      if (al && al !== 'FOTO' && al.length > 1) {
        allergens.push(al);
      }
    }

    // Merma: buscar la fila que contenga "MERMA" en texto (col 0)
    if (row[0] && String(row[0]).toLowerCase().includes('merma') && !String(row[0]).toLowerCase().includes('materia prima')) {
      const merma = Number(row[4]);
      if (!isNaN(merma) && merma > 0) mermaPct = merma;
    }
  }

  const totalCost = ingredients.reduce((sum, ing) => sum + ing.totalPrice, 0);
  const costPerServing = totalCost * (1 + mermaPct);

  return {
    name: recipeName || 'Receta sin nombre',
    category: 'complemento',
    author,
    ingredients,
    allergens,
    mermaPct,
    totalCost,
    costPerServing,
    instructions: instructionsLines.join('\n'),
  };
}

/**
 * Guarda la receta parseada en la BD
 */
export async function saveRecipeFromExcel(
  recipeData: ExcelRecipeData,
  category?: string
): Promise<RecipeImportResult> {
  return transaction(async (client) => {
    const name = recipeData.name;
    const cat = category || recipeData.category || 'complemento';
    const skipped: string[] = [];

    // 1. Crear o actualizar recipe
    let recipe = await client.query(
      `SELECT id FROM recipes WHERE name = $1 LIMIT 1`,
      [name]
    );

    let recipeId: string;
    if (recipe.rows.length > 0) {
      recipeId = recipe.rows[0].id;
      await client.query(
        `UPDATE recipes SET category = $1, instructions = $2, merma_pct = $3, updated_at = NOW() WHERE id = $4`,
        [cat, recipeData.instructions, recipeData.mermaPct, recipeId]
      );
    } else {
      const result = await client.query(
        `INSERT INTO recipes (name, category, description, instructions, merma_pct, cost_per_serving, servings, published, active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, 1, false, true, NOW(), NOW()) RETURNING id`,
        [name, cat, `Importado desde Excel. Autor: ${recipeData.author}`, recipeData.instructions, recipeData.mermaPct, recipeData.costPerServing]
      );
      recipeId = result.rows[0].id;
    }

    // 2. Crear catalog_item si no existe
    await client.query(
      `INSERT INTO catalog_items (name, category, pvp, cost, description, active, created_at, updated_at) VALUES ($1, $2, 0, $3, $4, true, NOW(), NOW()) ON CONFLICT (name) DO UPDATE SET category = EXCLUDED.category`,
      [name, cat, recipeData.costPerServing, `Importado desde Excel. Coste: ${recipeData.costPerServing.toFixed(2)}€`]
    );

    // 3. Procesar ingredientes
    let imported = 0;
    for (const ing of recipeData.ingredients) {
      // Buscar ingredient_id por nombre: primero exacto (sin acentos), luego
      // coincidencia de PALABRA completa (evita 'SAL'→'ensaladilla'/'salmón'
      // o 'MANTEQUILLA'→'mantequilla trufada' cuando el Excel es genérico).
      const normName = ing.name.trim().toLowerCase();
      let ingResult = await client.query(
        `SELECT id, unit_cost, cost_per_unit FROM ingredients WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1`,
        [ing.name]
      );

      if (ingResult.rows.length === 0) {
        // Match por palabra completa (el nombre del Excel es un token del catálogo)
        ingResult = await client.query(
          `SELECT id, unit_cost, cost_per_unit FROM ingredients
           WHERE LOWER(TRIM(name)) = $1
              OR LOWER(TRIM(name)) LIKE $2
              OR $1 LIKE ('%' || LOWER(TRIM(name)) || '%')
           LIMIT 1`,
          [normName, `${normName} %`]
        );
      }

      // Solo aceptar el match parcial si el candidato coincide casi por
      // completo (mismo nombre o el candidato empieza por el nombre del
      // Excel con algo más detrás: 'HARINA TRIGO' vs 'harina trigo premium').
      // Evita falsos positivos: 'sal'→'ensaladilla', 'sal'→'salmón',
      // 'mantequilla'→'mantequilla trufada' (el Excel es genérico: el
      // ingrediente debe crearse con el precio de la ficha).
      if (ingResult.rows.length > 0) {
        const candName = String(ingResult.rows[0].name || '').trim().toLowerCase();
        const candTokens = candName.split(/\s+/).filter(Boolean);
        const tokens = normName.split(/\s+/).filter(Boolean);
        // El nombre del Excel debe contener TODOS los tokens del candidato
        // (candidato más específico que el Excel) O ser idéntico por tokens.
        const excelHasAll = tokens.every(t => candName.split(/\s+/).includes(t));
        const candidateHasAll = candTokens.every(t => normName.split(/\s+/).includes(t));
        const sameTokenCount = candTokens.length === tokens.length;
        if (!(excelHasAll && candidateHasAll) && !(sameTokenCount && excelHasAll)) {
          ingResult.rows = [];
        }
      }

      let ingId: string;
      let unitCost = 0;

      if (ingResult.rows.length > 0) {
        ingId = ingResult.rows[0].id;
        unitCost = Number(ingResult.rows[0].unit_cost || ingResult.rows[0].cost_per_unit || 0);
      } else {
        // No existe: crearlo automáticamente con el precio del Excel
        const newIng = await client.query(
          `INSERT INTO ingredients (name, unit, unit_cost, cost_per_unit, active, created_at, updated_at) VALUES ($1, $2, $3, $3, true, NOW(), NOW()) RETURNING id`,
          [ing.name, ing.unit, ing.unitPrice]
        );
        ingId = newIng.rows[0].id;
        unitCost = ing.unitPrice;
      }

      const cost = ing.quantity * unitCost;
      await client.query(
        `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, per_guest, cost)
         VALUES ($1, $2, $3, $4, true, $5)
         ON CONFLICT (recipe_id, ingredient_id) DO UPDATE SET quantity = EXCLUDED.quantity, unit = EXCLUDED.unit, cost = EXCLUDED.cost`,
        [recipeId, ingId, ing.quantity, ing.unit, cost]
      );
      imported++;
    }

    // 4. Actualizar coste de la receta
    await client.query(
      `UPDATE recipes SET cost_per_serving = $1, updated_at = NOW() WHERE id = $2`,
      [recipeData.costPerServing, recipeId]
    );

    // 5. Guardar alérgenos en recipes y catalog_items
    if (recipeData.allergens.length > 0) {
      await client.query(
        `UPDATE recipes SET allergens = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(recipeData.allergens), recipeId]
      );
      try {
        await client.query(
          `UPDATE catalog_items SET allergens = $1 WHERE name = $2`,
          [JSON.stringify(recipeData.allergens), name]
        );
      } catch { /* columna puede no existir en catalog_items */ }
    }

    return {
      success: true,
      recipeName: name,
      recipeId,
      ingredientsImported: imported,
      ingredientsSkipped: skipped,
      allergens: recipeData.allergens,
      mermaPct: recipeData.mermaPct,
    };
  });
}