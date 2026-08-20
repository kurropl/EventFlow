/**
 * EventFlow — APPCC API (CORREGIDA)
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryMany } from '@/lib/db';
import { verifyToken, verifyAuth } from '@/lib/auth';
import { processUnifiedReception } from '@/lib/domain/appccReception';
import { sanitizeError } from '@/lib/security';


export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    const tipo = new URL(request.url).searchParams.get('tipo') || 'resumen';

    if (tipo === 'temperaturas') {
      return NextResponse.json({ success: true, data: await queryMany<any>(
        "SELECT ftl.id, ftl.fridge_name, ftl.temperature, ftl.recorded_at, ftl.event_id, e.client_name as evento_nombre FROM fridge_temperature_log ftl LEFT JOIN events e ON e.id = ftl.event_id ORDER BY ftl.recorded_at DESC LIMIT 50", []
      )});
    }
    if (tipo === 'limpieza') {
      return NextResponse.json({ success: true, data: await queryMany<any>(
        "SELECT cl.id, cl.area, cl.performed_by, cl.performed_at, cl.verified_by, cl.event_id, e.client_name as evento_nombre FROM cleaning_log cl LEFT JOIN events e ON e.id = cl.event_id ORDER BY cl.performed_at DESC LIMIT 50", []
      )});
    }
    if (tipo === 'trazabilidad') {
      return NextResponse.json({ success: true, data: await queryMany<any>(
        "SELECT tl.id, tl.ingredient_id, i.name as ingrediente, tl.lot_number, tl.used_at, tl.event_id, e.client_name as evento_nombre FROM traceability_log tl LEFT JOIN ingredients i ON i.id = tl.ingredient_id LEFT JOIN events e ON e.id = tl.event_id ORDER BY tl.used_at DESC LIMIT 50", []
      )});
    }

    const t = await queryMany<any>("SELECT COUNT(*)::int as total FROM fridge_temperature_log", []);
    const c = await queryMany<any>("SELECT COUNT(*)::int as total FROM cleaning_log", []);
    const tr = await queryMany<any>("SELECT COUNT(*)::int as total FROM traceability_log", []);
    return NextResponse.json({ success: true, data: { resumen: { temperaturas: t[0]?.total || 0, limpieza: c[0]?.total || 0, trazabilidad: tr[0]?.total || 0 } } });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

// ── POST: Registrar recepción APPCC (persiste lote + stock + movimiento) ──
// Reconstruido tras conflicto multi-agente (worker C): delega en
// processUnifiedReception (dominio) en una transacción.

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    const body = await request.json();
    if (!body.ingredient_name && !body.ingredient_id) {
      return NextResponse.json({ success: false, error: 'Ingrediente es obligatorio' }, { status: 400 });
    }

    const result = await processUnifiedReception({
      ingredientId: body.ingredient_id ?? null,
      lotNumber: body.lot_number || `LOT-${Date.now().toString(36).toUpperCase()}`,
      batchQuantity: Number(body.batch_quantity ?? body.cantidad ?? 0) || 0,
      unit: body.unit || 'ud',
      receivedDate: body.received_date || new Date().toISOString().split('T')[0],
      receivedBy: body.received_by || auth.name || 'admin',
      expiryDate: body.expiry_date || null,
      temperature: body.temperature ?? body.temp ?? null,
      supplier: body.supplier || null,
      conditionOk: body.condition_ok ?? false,
      notes: body.notes || null,
      source: 'manual',
      supplierOrderItemId: body.supplier_order_item_id || null,
    } as any);

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}