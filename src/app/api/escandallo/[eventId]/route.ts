/**
 * EventFlow — Escandallo API (teórico vs real, versionado)
 *
 * GET  /api/escandallo/[eventId]   — Resumen teórico↔real + líneas + desviación
 * PUT  /api/escandallo/[eventId]   — Registrar consumos reales (recalcula desviación)
 * POST /api/escandallo/[eventId]/freeze — Congelar escandallo (cierre)
 * POST /api/escandallo/[eventId]/recalc — Recalcular desde recipe_items
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sanitizeError } from '@/lib/security';
import { computeEscandallo, recordActuals } from '@/lib/escandallo';

export const dynamic = 'force-dynamic';

// ── GET ──
export async function GET(
  _req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const { eventId } = params;
    if (!eventId) {
      return NextResponse.json({ success: false, error: 'eventId required' }, { status: 400 });
    }

    const escandallo = await computeEscandallo(eventId);
    if (!escandallo) {
      return NextResponse.json({ success: false, error: 'Evento no encontrado' }, { status: 404 });
    }

    const event = (await query(
      `SELECT id, client_name, event_date, guest_count, total_pvp, total_cost, status, event_type
       FROM events WHERE id = $1`,
      [eventId]
    )).rows?.[0] || null;

    return NextResponse.json({
      success: true,
      data: escandallo.lineas,      // compat: lista de líneas
      escandallo,                   // resumen teórico↔real + totales + estado/versión
      event,
    });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}

// ── PUT (registrar consumos reales) ──
export async function PUT(
  req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const { eventId } = params;
    if (!eventId) {
      return NextResponse.json({ success: false, error: 'eventId required' }, { status: 400 });
    }

    const body = await req.json();
    const { items } = body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'items array required' }, { status: 400 });
    }

    const updated = await recordActuals(eventId, items);
    const escandallo = await computeEscandallo(eventId);

    return NextResponse.json({
      success: true,
      updated,
      escandallo,
      message: updated > 0 ? 'Consumos reales actualizados' : 'No se actualizó ningún item',
    });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}
