/**
 * EventFlow — Importar una ficha técnica individual desde Excel
 * POST /api/cocina/recipes/import-ficha
 *
 * A diferencia de /api/cocina/recipes/import (masivo, fila por ingrediente,
 * muchas recetas a la vez), esta ruta lee UN archivo con el layout fijo de
 * PLANTILLA_FICHA_TECNICA_AUTOMATIZADA.xlsx (una ficha completa por plato:
 * ingredientes+coste+elaboración+alérgenos+autor) y crea o actualiza la
 * receta correspondiente usando el mismo motor que el editor manual
 * (ensureCatalogItem/recomputeFicha), para que ambos caminos queden
 * siempre consistentes.
 *
 * Si ya existe una receta con el mismo nombre, se actualiza (sus líneas de
 * ingrediente se sustituyen por las del Excel) en vez de duplicarla —
 * mismo criterio que el import masivo existente.
 */
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { transaction } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sanitizeError } from '@/lib/security';
import { normalizeUnit, normalizeCategory } from '@/lib/recipeImport';
import { parseFichaTecnica, type CellGetter } from '@/lib/fichaTecnicaImport';
import { recomputeFicha } from '@/lib/domain/fichaTecnicaSync';

async function verifyAuth(request: NextRequest) {
  const token =
    request.cookies.get('admin_session')?.value ||
    request.cookies.get('eventflow_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ success: false, error: 'No se ha enviado ningún archivo' }, { status: 400 });

    const category = normalizeCategory(formData.get('category'));

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) {
      return NextResponse.json({ success: false, error: 'El archivo no tiene ninguna hoja' }, { status: 400 });
    }

    const get: CellGetter = (addr) => sheet[addr] as { v?: unknown } | undefined;
    const parsed = parseFichaTecnica(get);

    if (parsed.lineas.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se encontró ninguna línea de ingrediente válida en el archivo',
        errores: parsed.errores,
      }, { status: 400 });
    }

    const result = await transaction(async (client) => {
      // WP-11: operar directamente sobre catalog_items (tabla unificada)
      const existing = (await client.query(
        `SELECT id FROM catalog_items WHERE name ILIKE $1 LIMIT 1`, [parsed.name]
      )).rows[0];

      let recipeId: string;
      if (existing) {
        recipeId = existing.id;
        await client.query(
          `UPDATE catalog_items SET category = $1, instructions = $2, allergens = $3::jsonb, author = $4,
                              merma_pct = $5, peso_racion = $6, updated_at = now()
           WHERE id = $7`,
          [category, parsed.instructions, parsed.allergens ? JSON.stringify(parsed.allergens) : '[]', parsed.author, parsed.mermaPct, parsed.pesoRacion, recipeId]
        );
      } else {
        const created = (await client.query(
          `INSERT INTO catalog_items
             (name, category, instructions, allergens, author, merma_pct, peso_racion,
              version, active, published, ingredients, source, pvp, cost)
           VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, 1, true, false, '[]'::jsonb, 'excel', 0, 0)
           RETURNING id`,
          [parsed.name, category, parsed.instructions, parsed.allergens ? JSON.stringify(parsed.allergens) : '[]', parsed.author, parsed.mermaPct, parsed.pesoRacion]
        )).rows[0];
        recipeId = created.id;
      }

      // Sustituir las líneas de ingrediente por las del Excel (igual que el
      // import masivo: borrar y recrear, no intentar diffear fila a fila).
      await client.query(`DELETE FROM recipe_items WHERE catalog_item_id = $1`, [recipeId]);

      let ingredientesCreados = 0;
      for (const line of parsed.lineas) {
        const unidad = normalizeUnit(line.unidad) ?? 'g';
        let ing = (await client.query(
          `SELECT id FROM ingredients WHERE name ILIKE $1 LIMIT 1`, [line.ingrediente]
        )).rows[0];
        if (!ing) {
          ing = (await client.query(
            `INSERT INTO ingredients (name, unit, unit_cost) VALUES ($1, $2, $3) RETURNING id`,
            [line.ingrediente, unidad, line.precioUnitario ?? 0]
          )).rows[0];
          ingredientesCreados++;
        }
        // WP-11: recipeId ES el catalog_item_id (tabla unificada)
        await client.query(
          `INSERT INTO recipe_items (catalog_item_id, ingredient_id, quantity, unit)
           VALUES ($1, $2, $3, $4)`,
          [recipeId, ing.id, line.cantidad, unidad]
        );
      }

      if (parsed.pvp != null) {
        await client.query(`UPDATE catalog_items SET pvp = $1 WHERE id = $2`, [parsed.pvp, recipeId]);
      }

      const totales = await recomputeFicha(client, recipeId);

      return { recipeId, catalogItemId: recipeId, ingredientesCreados, actualizada: !!existing };
    });

    return NextResponse.json({
      success: true,
      data: { ...result, errores: parsed.errores },
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
