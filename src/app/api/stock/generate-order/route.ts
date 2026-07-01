/**
 * EventFlow — Generate Order API
 * POST /api/stock/generate-order — Auto-generate supplier orders from escandallo
 *
 * Delega en domain/inventoryCommitment.ts (checkInventoryShortages, la misma
 * que usa acceptQuote para G2) y domain/generateSupplierOrders.ts. Antes
 * tenía su propia lógica embebida con tres bugs reales (ver
 * SPEC-Sprint2-Inventory.md): convert_uom() no existía en schema.sql,
 * matching de ingrediente por nombre exacto (frágil), y nunca grababa
 * event_id en el pedido pese a que la columna existe.
 */

import { NextRequest, NextResponse } from 'next/server';
import { transaction } from '@/lib/db';
import { sanitizeError, isValidUUID } from '@/lib/security';
import { verifyToken } from '@/lib/auth';
import { checkInventoryShortages } from '@/lib/domain/inventoryCommitment';
import { generateSupplierOrdersForEvent } from '@/lib/domain/generateSupplierOrders';

// ── Auth helper ─────────────────────────────────────────────────────

function requireAuth(request: NextRequest): { authenticated: boolean; error?: string } {
  const token = request.cookies.get('admin_session')?.value || request.cookies.get('eventflow_token')?.value;
  if (!token) {
    return { authenticated: false, error: 'No autenticado' };
  }
  const user = verifyToken(token);
  if (!user) {
    return { authenticated: false, error: 'Token inválido o expirado' };
  }
  return { authenticated: true };
}

// ── POST: Generate supplier orders from escandallo ──────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { event_id } = body as { event_id?: string };

    if (!event_id || !isValidUUID(event_id)) {
      return NextResponse.json(
        { success: false, error: 'event_id válido es requerido' },
        { status: 422 }
      );
    }

    const createdOrders = await transaction(async (client) => {
      const shortages = await checkInventoryShortages(client, event_id);
      if (shortages.length === 0) return [];
      const { orders } = await generateSupplierOrdersForEvent(client, event_id, shortages);
      return orders;
    });

    if (createdOrders.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No hay faltante de stock para este evento (o no tiene escandallo generado)' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: createdOrders });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
