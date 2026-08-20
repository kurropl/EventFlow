/**
 * EventFlow — Líneas de ingrediente de la ficha técnica
 * POST /api/cocina/recipes/[id]/items — Añadir una línea (cantidad/medida/ingrediente/precio unitario)
 *
 * El ingrediente se resuelve por nombre contra `ingredients` (entidad única,
 * FR-S05); si no existe se crea con coste 0 (se fija después desde Stock).
 * Tras cada cambio se recalculan y sincronizan peso/raciones/coste (ver
 * src/lib/domain/fichaTecnicaSync.ts).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { transaction } from '@/lib/db';
import { verifyToken, verifyAuth } from '@/lib/auth';
import { sanitizeError, isValidUUID } from '@/lib/security';
import { normalizeUnit } from '@/lib/recipeImport';
import { ensureCatalogItem, recomputeFicha } from '@/lib/domain/fichaTecnicaSync';


const AddItemSchema = z.object({
  ingredient_name: z.string().min(1, 'El ingrediente es obligatorio'),
  quantity: z.number().positive('La cantidad debe ser mayor que 0'),
  unit: z.string().optional().default('g'),
  notes: z.string().max(500).optional().nullable(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!isValidUUID(id)) return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 });

    const body = await request.json();
    const parsed = AddItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Validation error' },
        { status: 422 }
      );
    }
    const { ingredient_name, quantity, unit, notes } = parsed.data;
    const normalizedUnit = normalizeUnit(unit) ?? 'g';

    const result = await transaction(async (client) => {
      const catalogItemId = await ensureCatalogItem(client, id);

      let ing = (await client.query(
        `SELECT id, unit_cost FROM ingredients WHERE name ILIKE $1 LIMIT 1`,
        [ingredient_name.trim()]
      )).rows[0];
      if (!ing) {
        ing = (await client.query(
          `INSERT INTO ingredients (name, unit, unit_cost) VALUES ($1, $2, 0) RETURNING id, unit_cost`,
          [ingredient_name.trim(), normalizedUnit]
        )).rows[0];
      }

      const item = (await client.query(
        `INSERT INTO recipe_items (catalog_item_id, ingredient_id, quantity, unit, notes)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [catalogItemId, ing.id, quantity, normalizedUnit, notes ?? null]
      )).rows[0];

      const totales = await recomputeFicha(client, id);
      return { item_id: item.id, totales };
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
