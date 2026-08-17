/**
 * EventFlow — Regularizaciones de inventario
 * GET  /api/stock/regularizaciones — lista ajustes
 * POST /api/stock/regularizaciones — registrar ajuste (recuento/rotura/merma/caducado/sobrante)
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sanitizeError } from '@/lib/security';

function auth(r: NextRequest) {
  const t = r.cookies.get('admin_session')?.value || r.cookies.get('eventflow_token')?.value;
  return t ? verifyToken(t) : null;
}

export async function GET(r: NextRequest) {
  try {
    if (!auth(r)) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    const data = await queryMany(
      `SELECT ia.*, i.name AS ingredient_name
       FROM inventory_adjustments ia
       JOIN ingredients i ON i.id = ia.ingredient_id
       ORDER BY ia.created_at DESC LIMIT 100`
    );
    return NextResponse.json({ success: true, data });
  } catch (e) { return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 }); }
}

export async function POST(r: NextRequest) {
  try {
    if (!auth(r)) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    const b = await r.json();
    if (!b.ingredient_id || !b.tipo || b.ajuste === undefined || b.ajuste === null) {
      return NextResponse.json({ success: false, error: 'Faltan campos: ingredient_id, tipo, ajuste' }, { status: 400 });
    }
    const TIPOS = ['recuento','rotura','merma','caducado','sobrante','ajuste'];
    if (!TIPOS.includes(b.tipo)) return NextResponse.json({ success: false, error: `Tipo inválido: ${b.tipo}` }, { status: 400 });
    const ajuste = Number(b.ajuste);
    if (!Number.isFinite(ajuste) || ajuste === 0) return NextResponse.json({ success: false, error: 'Ajuste debe ser distinto de 0' }, { status: 400 });

    await querySingle(
      `UPDATE ingredients SET quantity = GREATEST(0, quantity + $1) WHERE id = $2`,
      [ajuste, b.ingredient_id]
    );
    const row = await querySingle(
      `INSERT INTO inventory_adjustments (ingredient_id, ajuste, tipo, motivo, responsable)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [b.ingredient_id, ajuste, b.tipo, b.motivo || null, b.responsable || null]
    );
    return NextResponse.json({ success: true, data: row });
  } catch (e) { return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 }); }
}