/**
 * EventFlow — Importar recetas desde Excel/CSV → recipe_items  ·  FR-C10
 *
 * GET  /api/cocina/recipes/import        → descarga la plantilla vacía (CSV)
 * POST /api/cocina/recipes/import        → previsualización (no escribe)
 * POST /api/cocina/recipes/import?commit=1 → confirma: upsert catalog_items + recipe_items
 *
 * El ingrediente se resuelve por nombre contra `ingredients` (entidad única,
 * FR-S05); si no existe se crea. La cantidad se ajusta por merma (bruto vs neto).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { sanitizeError } from '@/lib/security';
import * as XLSX from 'xlsx';
import {
  detectColumns, parseRows, normalizeCategory, CATALOG_CATEGORIES,
  type ParsedRecipe,
} from '@/lib/recipeImport';

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
// Convención canónica: ingredients.unit_cost es €/unidad-del-ingrediente (la misma
// unidad en que se expresa la cantidad de receta). coste_línea = qty × unit_cost.
const lineCost = (qty: number, unitCost: number) => round2((Number(qty) || 0) * (Number(unitCost) || 0));

// Plantilla descargable
export async function GET() {
  const header = 'plato,categoria,ingrediente,cantidad,unidad,merma_%,notas';
  const ejemplo = [
    'Solomillo al foie,carne,Solomillo de ternera,200,g,15,Limpio de grasa',
    'Solomillo al foie,carne,Foie micuit,30,g,0,',
    'Solomillo al foie,carne,Sal en escamas,2,g,0,',
  ].join('\n');
  const csv = `${header}\n${ejemplo}\n`;
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="plantilla-recetas.csv"',
    },
  });
}

async function readRows(req: NextRequest): Promise<{ rows: Record<string, any>[]; headers: string[] } | null> {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return null;
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, any>[];
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return { rows, headers };
}

export async function POST(req: NextRequest) {
  try {
    const commit = req.nextUrl.searchParams.get('commit') === '1';
    const parsed = await readRows(req);
    if (!parsed) return NextResponse.json({ success: false, error: 'No se ha enviado ningún archivo' }, { status: 400 });
    if (!parsed.rows.length) return NextResponse.json({ success: false, error: 'El archivo está vacío' }, { status: 400 });

    const cols = detectColumns(parsed.headers);
    if (!cols.plato || !cols.ingrediente) {
      return NextResponse.json({
        success: false,
        error: 'El archivo debe tener al menos columnas "plato" e "ingrediente"',
        cabeceras: parsed.headers,
        mapeo: cols,
      }, { status: 400 });
    }

    const recetas = parseRows(parsed.rows, cols);
    const pool = getPool();

    // ── Resolver ingredientes contra la BD (preview y commit) ──
    const resumen = await buildSummary(pool, recetas);

    if (!commit) {
      return NextResponse.json({
        success: true,
        mode: 'preview',
        categorias_validas: CATALOG_CATEGORIES,
        ...resumen,
      });
    }

    // ── COMMIT: upsert catalog_items + recipe_items ──
    let platosCreados = 0, platosActualizados = 0, ingredientesCreados = 0;
    for (const r of recetas) {
      const category = normalizeCategory(r.categoria);

      // catalog_item (por nombre)
      const existing = (await pool.query(
        `SELECT id FROM catalog_items WHERE name ILIKE $1 LIMIT 1`, [r.plato]
      )).rows[0];
      let catalogId: string;
      if (existing) {
        catalogId = existing.id;
        platosActualizados++;
        await pool.query(`DELETE FROM recipe_items WHERE catalog_item_id = $1`, [catalogId]);
      } else {
        catalogId = (await pool.query(
          `INSERT INTO catalog_items (name, category, pvp, cost, ingredients, active)
           VALUES ($1, $2, 0, 0, '[]'::jsonb, true) RETURNING id`,
          [r.plato, category]
        )).rows[0].id;
        platosCreados++;
      }

      let costePlato = 0;
      for (const line of r.lineas) {
        if (line.errores.length || !line.unidad) continue;
        // ingrediente único por id (crea si no existe)
        let ing = (await pool.query(
          `SELECT id, unit_cost FROM ingredients WHERE name ILIKE $1 LIMIT 1`, [line.ingrediente]
        )).rows[0];
        if (!ing) {
          ing = (await pool.query(
            `INSERT INTO ingredients (name, unit, unit_cost) VALUES ($1, $2, 0)
             RETURNING id, unit_cost`,
            [line.ingrediente, line.unidad]
          )).rows[0];
          ingredientesCreados++;
        }
        await pool.query(
          // G11 (Sprint 4): persistir merma_pct — antes se calculaba
          // (grossFromNet) y se descartaba tras usarlo para cantidad_bruta.
          `INSERT INTO recipe_items (catalog_item_id, ingredient_id, quantity, unit, notes, merma_pct)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [catalogId, ing.id, line.cantidad_bruta, line.unidad, line.notas, line.merma_pct]
        );
        // C1: resolve price from history (latest) before fallback
        const priceRow = await pool.query(
          `SELECT COALESCE(h.new_price, i.unit_cost, 0) AS cost
             FROM ingredients i
             LEFT JOIN LATERAL (
               SELECT hh.new_price
                 FROM ingredient_price_history hh
                WHERE hh.ingredient_id = i.id
                ORDER BY hh.recorded_at DESC NULLS LAST
                LIMIT 1
             ) h ON true
            WHERE i.id = $1`, [ing.id]
        );
        const resolvedCost = Number(priceRow.rows[0]?.cost ?? 0);
        costePlato += lineCost(line.cantidad_bruta, resolvedCost);
      }
      // coste del plato = Σ ingredientes (FR-S03)
      await pool.query(`UPDATE catalog_items SET cost = $2 WHERE id = $1`, [catalogId, round2(costePlato)]);
    }

    return NextResponse.json({
      success: true,
      mode: 'commit',
      platos_creados: platosCreados,
      platos_actualizados: platosActualizados,
      ingredientes_creados: ingredientesCreados,
      recetas: recetas.length,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

/** Resuelve ingredientes existentes/nuevos y calcula coste estimado (sin escribir). */
async function buildSummary(pool: ReturnType<typeof getPool>, recetas: ParsedRecipe[]) {
  const preview = [];
  let ingredientesNuevos = 0, filasConError = 0;
  for (const r of recetas) {
    const lineas = [];
    let coste = 0;
    for (const line of r.lineas) {
      const ing = (await pool.query(
        `SELECT id, unit_cost FROM ingredients WHERE name ILIKE $1 LIMIT 1`, [line.ingrediente]
      )).rows[0];
      const esNuevo = !ing;
      if (esNuevo) ingredientesNuevos++;
      if (line.errores.length) filasConError++;
      const costeLinea = ing ? lineCost(line.cantidad_bruta, ing.unit_cost) : null;
      if (costeLinea) coste += costeLinea;
      lineas.push({
        ingrediente: line.ingrediente,
        cantidad_neta: line.cantidad_neta,
        cantidad_bruta: line.cantidad_bruta,
        merma_pct: line.merma_pct,
        unidad: line.unidad,
        ingrediente_nuevo: esNuevo,
        coste_estimado: costeLinea,
        errores: line.errores,
      });
    }
    preview.push({ plato: r.plato, categoria: normalizeCategory(r.categoria), coste_estimado: round2(coste), lineas });
  }
  return {
    recetas: preview.length,
    ingredientes_nuevos: ingredientesNuevos,
    filas_con_error: filasConError,
    preview,
  };
}
