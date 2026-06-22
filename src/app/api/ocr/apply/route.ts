/**
 * POST /api/ocr/apply
 * Aplica los datos extraídos por OCR al sistema:
 * - Crea/actualiza items en stock_entries
 * - Crea entradas en ingredient_price_history
 * - Actualiza current_price en ingredients
 * - Crea lotes en trazabilidad_lotes (si hay etiqueta)
 * - Crea supplier_orders y supplier_order_items (si hay ticket_proveedor con proveedor)
 * - Enlaza stock_entries con supplier_order_items
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

interface ApplyItem {
  name: string;
  quantity: number;
  unit: string;
  cost: number;
  supplier?: string;
  lot?: string;
  expiry?: string;
  barcode?: string;
}

interface StockEntry {
  id: string;
}

interface SupplierOrder {
  id: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mode, items, eventId } = body as {
      mode: string;
      items: ApplyItem[];
      eventId?: string;
    };

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'No hay items para aplicar' }, { status: 400 });
    }

    const results: Array<{
      name: string;
      status: string;
      stockId?: string;
      ingredientId?: string;
      supplierOrderId?: string;
      orderItemId?: string;
    }> = [];

    const priceUpdates: Array<{ ingredientId: string; newPrice: number; supplier: string }> = [];

    // ── FLUJO: supplier_orders ──
    // Si es ticket_proveedor y hay supplier, crear/actualizar supplier_order
    let supplierOrderId: string | null = null;
    let supplierName = '';

    if (mode === 'ticket_proveedor') {
      // Buscar el primer supplier de los items
      const supplierItem = items.find(i => i.supplier);
      if (supplierItem?.supplier) {
        supplierName = supplierItem.supplier;
      }
      // También buscar en cada item
      if (!supplierName) {
        for (const item of items) {
          if (item.supplier) {
            supplierName = item.supplier;
            break;
          }
        }
      }

      if (supplierName) {
        // Buscar si ya existe un pedido pendiente del mismo proveedor
        const existingOrder = await query(
          `SELECT id FROM supplier_orders
           WHERE LOWER(supplier) = LOWER($1) AND status IN ('pending', 'partial', 'delivered')
           ORDER BY created_at DESC LIMIT 1`,
          [supplierName]
        );

        if (existingOrder.rows.length > 0) {
          supplierOrderId = (existingOrder.rows[0] as any).id;
        } else {
          // Buscar proveedor registrado
          const provider = await query(
            `SELECT id FROM providers WHERE LOWER(name) = LOWER($1) LIMIT 1`,
            [supplierName]
          );

          // Crear nuevo supplier_order
          const newOrder = await query(
            `INSERT INTO supplier_orders (supplier, status, total_cost, notes, event_id, origin)
             VALUES ($1, 'delivered', $2, $3, $4, 'ocr')
             RETURNING id`,
            [
              supplierName,
              0,
              `OCR: ${items.length} items escaneados de ticket`,
              eventId || null,
            ]
          );
          supplierOrderId = ((newOrder.rows[0] as any) as SupplierOrder).id;
        }
      }
    }

    // ── FLUJO: procesar cada item ──
    let totalOrderCost = 0;
    const orderItemIds: string[] = [];

    for (const item of items) {
      const itemName = (item.name || '').toLowerCase().trim();
      if (!itemName) continue;

      // Buscar ingrediente existente
      const ingResult = await query(
        `SELECT id, name, current_price, unit FROM ingredients WHERE LOWER(name) = $1 LIMIT 1`,
        [itemName]
      );

      const ingRow = (ingResult.rows?.[0] || null) as any;
      const ingredientId: string | null = ingRow?.id || null;

      if (ingredientId) {
        // 1. Actualizar precio si distinto
        if (item.cost > 0) {
          const currentPrice = ingRow?.current_price ? Number(ingRow.current_price) : 0;
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
        const movementReason = mode === 'albaran' || mode === 'ticket_proveedor'
          ? 'compra_prevision' as const
          : 'operativo' as const;

        const stockResult = await query(
          `INSERT INTO stock_entries (ingredient_id, quantity, unit, event_id, notes, cost_price, movement_reason)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [
            ingredientId,
            item.quantity || 1,
            item.unit || 'ud',
            eventId || null,
            `OCR: ${mode} - ${itemName}${item.supplier ? ` (${item.supplier})` : ''}`,
            item.cost || null,
            movementReason,
          ]
        );
        const stockRow = (stockResult.rows?.[0] || null) as any;
        const stockId = stockRow?.id || '';

        // 3. Si hay supplier_order, crear supplier_order_item
        let orderItemId: string | null = null;
        if (supplierOrderId) {
          const orderItemResult = await query(
            `INSERT INTO supplier_order_items (order_id, ingredient_id, ingredient_name, quantity, unit_cost, unit)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id`,
            [supplierOrderId, ingredientId, itemName, item.quantity || 1, item.cost || 0, item.unit || 'ud']
          );
          orderItemId = ((orderItemResult.rows[0] as any) || {}).id || null;
          if (orderItemId) orderItemIds.push(orderItemId);
          totalOrderCost += (item.cost || 0) * (item.quantity || 1);
        }

        // 4. Si es etiqueta con lote, registrar en receiving_log
        if (mode === 'etiqueta_ingrediente' && item.lot) {
          try {
            await query(
              `INSERT INTO receiving_log (ingredient_id, lot_number, batch_quantity, unit, supplier, expiry_date, source, notes)
               VALUES ($1, $2, $3, $4, $5, $6, 'scan', $7)`,
              [
                ingredientId,
                item.lot || 'SIN-LOTE',
                item.quantity || 1,
                item.unit || 'ud',
                item.supplier || null,
                item.expiry ? new Date(item.expiry).toISOString() : null,
                `OCR: ${mode} - ${itemName}`,
              ]
            );
          } catch {
            // tabla receiving_log puede tener restricciones
          }
        }

        results.push({
          name: itemName,
          status: 'stock_created',
          stockId,
          ingredientId,
          supplierOrderId: supplierOrderId || undefined,
          orderItemId: orderItemId || undefined,
        });
      } else {
        // Ingrediente no encontrado
        const stockResult = await query(
          `INSERT INTO stock_entries (ingredient_id, quantity, unit, event_id, notes, cost_price, movement_reason)
           VALUES (NULL, $1, $2, $3, $4, $5, 'operativo')
           RETURNING id`,
          [
            item.quantity || 1,
            item.unit || 'ud',
            eventId || null,
            `OCR: ${mode} - ${itemName} (ingrediente no encontrado)${item.cost ? ` [${item.cost}€]` : ''}`,
            item.cost || null,
          ]
        );
        const stockRow2 = (stockResult.rows?.[0] || null) as any;

        // Si hay supplier_order, crear supplier_order_item igualmente
        let orderItemId2: string | null = null;
        if (supplierOrderId) {
          const orderItemResult = await query(
            `INSERT INTO supplier_order_items (order_id, ingredient_id, ingredient_name, quantity, unit_cost, unit)
             VALUES ($1, NULL, $2, $3, $4, $5)
             RETURNING id`,
            [supplierOrderId, itemName, item.quantity || 1, item.cost || 0, item.unit || 'ud']
          );
          orderItemId2 = ((orderItemResult.rows[0] as any) || {}).id || null;
          if (orderItemId2) orderItemIds.push(orderItemId2);
          totalOrderCost += (item.cost || 0) * (item.quantity || 1);
        }

        results.push({
          name: itemName,
          status: 'stock_created_no_match',
          stockId: String(stockRow2?.id || ''),
          supplierOrderId: supplierOrderId || undefined,
          orderItemId: orderItemId2 || undefined,
        });
      }
    }

    // ── Actualizar total del supplier_order ──
    if (supplierOrderId) {
      await query(
        `UPDATE supplier_orders SET total_cost = $1, updated_at = NOW() WHERE id = $2`,
        [totalOrderCost, supplierOrderId]
      );
    }

    // ── Aplicar actualizaciones de precio ──
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
      supplierOrderId: supplierOrderId || undefined,
      supplierName: supplierName || undefined,
      orderItemsCount: orderItemIds.length,
    });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}