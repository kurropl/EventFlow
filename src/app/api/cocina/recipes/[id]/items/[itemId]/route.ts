/**
 * EventFlow — Línea de ingrediente individual de la ficha técnica
 * PUT    /api/cocina/recipes/[id]/items/[itemId] — Editar cantidad/medida/notas
 * DELETE /api/cocina/recipes/[id]/items/[itemId] — Quitar la línea
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { transaction } from '@/lib/db';
import { verifyToken, verifyAuth } from '@/lib/auth';
import { sanitizeError, isValidUUID } from '@/lib/security';
import { normalizeUnit } from '@/lib/recipeImport';
import { recomputeFicha } from '@/lib/domain/fichaTecnicaSync';


const UpdateItemSchema = z.object({
  quantity: z.number().positive().optional(),
  unit: z.string().optional(),
  notes: z.string().max(500).optional().nullable(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id, itemId } = await params;
    if (!isValidUUID(id) || !isValidUUID(itemId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = UpdateItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Validation error' },
        { status: 422 }
      );
    }
    const { quantity, unit, notes } = parsed.data;

    const result = await transaction(async (client) => {
      // WP-11: el id de receta ES el catalog_item_id (tabla unificada)
      const recipe = (await client.query(`SELECT id FROM catalog_items WHERE id = $1`, [id])).rows[0];
      if (!recipe) throw new Error('Receta no encontrada');

      const sets: string[] = [];
      const values: any[] = [];
      let idx = 1;
      if (quantity !== undefined) { sets.push(`quantity = $${idx++}`); values.push(quantity); }
      if (unit !== undefined) { sets.push(`unit = $${idx++}`); values.push(normalizeUnit(unit) ?? 'g'); }
      if (notes !== undefined) { sets.push(`notes = $${idx++}`); values.push(notes ?? null); }
      if (sets.length === 0) throw new Error('Nada que actualizar');
      sets.push(`updated_at = now()`);
      values.push(itemId, recipe.id);

      const updated = (await client.query(
        `UPDATE recipe_items SET ${sets.join(', ')} WHERE id = $${idx} AND catalog_item_id = $${idx + 1} RETURNING id`,
        values
      )).rows[0];
      if (!updated) throw new Error('Línea no encontrada');

      const totales = await recomputeFicha(client, id);
      return { item_id: updated.id, totales };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id, itemId } = await params;
    if (!isValidUUID(id) || !isValidUUID(itemId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 });
    }

    const result = await transaction(async (client) => {
      // WP-11: el id de receta ES el catalog_item_id (tabla unificada)
      const recipe = (await client.query(`SELECT id FROM catalog_items WHERE id = $1`, [id])).rows[0];
      if (!recipe) throw new Error('Receta no encontrada');

      const deleted = (await client.query(
        `DELETE FROM recipe_items WHERE id = $1 AND catalog_item_id = $2 RETURNING id`,
        [itemId, recipe.id]
      )).rows[0];
      if (!deleted) throw new Error('Línea no encontrada');

      const totales = await recomputeFicha(client, id);
      return { totales };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
