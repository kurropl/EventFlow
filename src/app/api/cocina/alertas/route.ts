/**
 * GET /api/cocina/alertas — Alertas para cocina
 *
 * Devuelve:
 *  - Ingredientes próximos a caducar (dentro de X días)
 *  - Stock bajo (por debajo del mínimo)
 *  - Últimas recepciones con lotes
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const daysThreshold = parseInt(searchParams.get('days') || '7', 10);

    // 1. Lotes próximos a caducar
    const expiringResult = await query(
      `SELECT rl.id, rl.lot_number, rl.expiry_date, rl.batch_quantity, rl.unit, rl.supplier,
              i.id as ingredient_id, i.name as ingredient_name,
              rl.received_date,
              EXTRACT(DAY FROM (rl.expiry_date - CURRENT_DATE)) as days_until_expiry
       FROM receiving_log rl
       LEFT JOIN ingredients i ON i.id = rl.ingredient_id
       WHERE rl.expiry_date IS NOT NULL
         AND rl.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + $1::int
       ORDER BY rl.expiry_date ASC
       LIMIT 50`,
      [daysThreshold]
    );

    // 2. Stock por debajo del mínimo
    const lowStockResult = await query(
      `SELECT inv.id, inv.quantity, inv.unit, inv.min_stock,
              i.id as ingredient_id, i.name as ingredient_name, i.current_price,
              (inv.min_stock - inv.quantity) as deficit
       FROM inventory inv
       JOIN ingredients i ON i.id = inv.ingredient_id
       WHERE inv.min_stock > 0 AND inv.quantity < inv.min_stock
       ORDER BY deficit DESC
       LIMIT 50`
    );

    // 3. Últimas recepciones (para feed de actividad)
    const recentResult = await query(
      `SELECT rl.id, rl.lot_number, rl.batch_quantity, rl.unit, rl.supplier,
              i.name as ingredient_name,
              rl.received_date, rl.expiry_date, rl.source
       FROM receiving_log rl
       LEFT JOIN ingredients i ON i.id = rl.ingredient_id
       ORDER BY rl.created_at DESC
       LIMIT 20`
    );

    // 4. Contadores
    const countsResult = await query(
      `SELECT
         (SELECT COUNT(*) FROM receiving_log WHERE expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE + 3) as critical,
         (SELECT COUNT(*) FROM receiving_log WHERE expiry_date IS NOT NULL AND expiry_date BETWEEN CURRENT_DATE + 3 AND CURRENT_DATE + 7) as warning,
         (SELECT COUNT(*) FROM inventory WHERE min_stock > 0 AND quantity < min_stock) as low_stock,
         (SELECT COUNT(*) FROM receiving_log WHERE created_at >= NOW() - INTERVAL '24 hours') as received_today`
    );

    const counts = countsResult.rows[0] as any;

    return NextResponse.json({
      success: true,
      data: {
        expiringSoon: (expiringResult.rows || []).map((r: any) => ({
          id: r.id,
          lotNumber: r.lot_number,
          expiryDate: r.expiry_date,
          daysUntilExpiry: Number(r.days_until_expiry),
          ingredientId: r.ingredient_id,
          ingredientName: r.ingredient_name || 'Desconocido',
          batchQuantity: Number(r.batch_quantity),
          unit: r.unit,
          supplier: r.supplier,
          receivedDate: r.received_date,
        })),
        lowStock: (lowStockResult.rows || []).map((r: any) => ({
          id: r.id,
          ingredientId: r.ingredient_id,
          ingredientName: r.ingredient_name,
          quantity: Number(r.quantity),
          minStock: Number(r.min_stock),
          deficit: Number(r.deficit),
          unit: r.unit,
          currentPrice: r.current_price ? Number(r.current_price) : null,
        })),
        recentReceiving: (recentResult.rows || []).map((r: any) => ({
          id: r.id,
          lotNumber: r.lot_number,
          ingredientName: r.ingredient_name || 'Desconocido',
          quantity: Number(r.batch_quantity),
          unit: r.unit,
          supplier: r.supplier,
          receivedDate: r.received_date,
          expiryDate: r.expiry_date,
          source: r.source,
        })),
        counts: {
          critical: Number(counts?.critical || 0),
          warning: Number(counts?.warning || 0),
          lowStock: Number(counts?.low_stock || 0),
          receivedToday: Number(counts?.received_today || 0),
        },
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}