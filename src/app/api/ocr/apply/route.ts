/**
 * POST /api/ocr/apply
 * Aplica los datos extraídos por OCR al sistema:
 * - Crea/actualiza items en stock_entries
 * - Crea entradas en ingredient_price_history
 * - Actualiza current_price en ingredients
 * - Crea lotes en trazabilidad_lotes (si hay etiqueta)
 * - Crea entrada en recepcion de trazabilidad (si hay albarán)
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mode, items, eventId } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'No hay items para aplicar' }, { status: 400 });
    }

    const results: Array<{ name: string; status: string; stockId?: string; ingredientId?: string }> = [];
    const priceUpdates: Array<{ ingredientId: string; newPrice: number; supplier: string }> = [];

    for (const item of items) {
      const itemName = (item.name || '').toLowerCase().trim();
      if (!itemName) continue;

      // Buscar ingrediente existente
      const ingResult = await query(
        `SELECT id, name, current_price, unit FROM ingredients WHERE LOWER(name) = $1 LIMIT 1`,
        [itemName]
      );

      let ingredientId: string | null = null;
      const ingRow = ingResult.rows?.[0] as any;

      if (ingRow) {
        ingredientId = ingRow.id;
      }

      if (ingredientId) {
        // 1. Si el OCR tiene coste y es distinto al actual, crear price_history
        if (item.cost > 0) {
          const currentPrice = ingRow?.current_price
            ? Number(ingRow.current_price)
            : 0;

          if (Math.abs(currentPrice - item.cost) > 0.01) {
            await query(
              `INSERT INTO ingredient_price_history (ingredient_id, price, effective_date, notes)
               VALUES ($1, $2, NOW(), $3)`,
              [ingredientId, item.cost, `OCR: ${item.supplier || mode} - ${itemName}`]
            );

            priceUpdates.push({
              ingredientId,
              newPrice: item.cost,
              supplier: item.supplier || mode,
            });
          }
        }

        // 2. Crear entrada en stock_entries
        const stockResult = await query(
          `INSERT INTO stock_entries (ingredient_id, quantity, unit, event_id, notes, cost_price)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [
            ingredientId,
            item.quantity || 1,
            item.unit || 'ud',
            eventId || null,
            `OCR: ${mode} - ${itemName}${item.supplier ? ` (${item.supplier})` : ''}`,
            item.cost || null,
          ]
        );

        const stockRow = stockResult.rows?.[0] as any;

        results.push({
          name: itemName,
          status: 'stock_created' as const,
          stockId: String(stockRow?.id || ''),
          ingredientId: String(ingredientId || ''),
        });

        // 3. Si es etiqueta con lote, registrar en trazabilidad
        if (mode === 'etiqueta_ingrediente' && (item.lot || item.expiry)) {
          await query(
            `INSERT INTO trazabilidad_lotes (ingredient_id, lote, fecha_caducidad, cantidad, unidad, notas)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              ingredientId,
              item.lot || 'SIN-LOTE',
              item.expiry ? new Date(item.expiry).toISOString() : null,
              item.quantity || 1,
              item.unit || 'ud',
              `Registrado por OCR (etiqueta)`,
            ]
          ).catch(() => {});
        }
      } else {
        // Ingrediente no encontrado en BD — registrar en stock_entries con ingredient_name si existe
        const stockResult = await query(
          `INSERT INTO stock_entries (ingredient_id, quantity, unit, event_id, notes, cost_price)
           VALUES (NULL, $1, $2, $3, $4, $5)
           RETURNING id`,
          [
            item.quantity || 1,
            item.unit || 'ud',
            eventId || null,
            `OCR: ${mode} - ${itemName} (ingrediente no encontrado)${item.cost ? ` [${item.cost}€]` : ''}`,
            item.cost || null,
          ]
        );

        const stockRow2 = stockResult.rows?.[0] as any;
        results.push({
          name: itemName,
          status: 'stock_created_no_match' as const,
          stockId: String(stockRow2?.id || ''),
        });
      }
    }

    // Aplicar actualizaciones de precio
    for (const update of priceUpdates) {
      await query(
        `UPDATE ingredients SET current_price = $1 WHERE id = $2`,
        [update.newPrice, update.ingredientId]
      );
    }

    return NextResponse.json({
      success: true,
      results,
      priceUpdates: priceUpdates.length,
      totalProcessed: items.length,
    });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}