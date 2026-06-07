/**
 * EventFlow — Escandallos (Shopping Lists by Event) API Route
 * GET /api/stock/escandallos — List event_shopping_items grouped by event
 * PUT /api/stock/escandallos — Update quantities/notes on a shopping item
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { sanitizeError } from '@/lib/security';
import { verifyToken } from '@/lib/auth';

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

// ── GET: Escandallos grouped by event ──────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');
    const showCompleted = searchParams.get('completed');

    const conditions: string[] = [];
    const values: (string | boolean)[] = [];
    let idx = 1;

    if (eventId) {
      conditions.push(`esi.event_id = $${idx++}`);
      values.push(eventId);
    }

    if (showCompleted !== null && showCompleted !== undefined && showCompleted !== '') {
      conditions.push(`esi.completed = $${idx++}`);
      values.push(showCompleted === 'true');
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Fetch all shopping items with event info, grouped in SQL
    const rows = await queryMany<any>(
      `SELECT
         esi.id,
         esi.event_id,
         esi.order_id,
         esi.ingredient_name,
         esi.provider_name,
         esi.total_grams,
         esi.total_units,
         esi.total_ml,
         esi.custom_qty,
         esi.notes,
         esi.completed,
         e.client_name AS event_name,
         e.event_date AS event_date
       FROM event_shopping_items esi
       LEFT JOIN events e ON e.id = esi.event_id
       ${where}
       ORDER BY e.event_date DESC NULLS LAST, esi.ingredient_name ASC`,
      values
    );

    // Group by event
    const grouped: Record<string, { event_name: string; event_date: string | null; items: any[] }> = {};

    for (const row of rows) {
      const key = row.event_id || 'sin-evento';
      if (!grouped[key]) {
        grouped[key] = {
          event_name: row.event_name || 'Sin evento',
          event_date: row.event_date || null,
          items: [],
        };
      }
      grouped[key].items.push({
        id: row.id,
        order_id: row.order_id,
        ingredient_name: row.ingredient_name,
        provider_name: row.provider_name,
        total_grams: row.total_grams,
        total_units: row.total_units,
        total_ml: row.total_ml,
        custom_qty: row.custom_qty,
        notes: row.notes,
        completed: row.completed,
      });
    }

    return NextResponse.json({ success: true, data: grouped });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// ── PUT: Update escandallo quantities/notes ────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, total_grams, total_units, total_ml, notes } = body as {
      id?: string;
      total_grams?: number;
      total_units?: number;
      total_ml?: number;
      notes?: string;
    };

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'El campo "id" es obligatorio' },
        { status: 400 }
      );
    }

    // Build dynamic SET clause — only update provided fields
    const sets: string[] = [];
    const values: (string | number | null)[] = [];
    let idx = 1;

    if (total_grams !== undefined) {
      sets.push(`total_grams = $${idx++}`);
      values.push(total_grams);
    }
    if (total_units !== undefined) {
      sets.push(`total_units = $${idx++}`);
      values.push(total_units);
    }
    if (total_ml !== undefined) {
      sets.push(`total_ml = $${idx++}`);
      values.push(total_ml);
    }
    if (notes !== undefined) {
      sets.push(`notes = $${idx++}`);
      values.push(notes);
    }

    if (sets.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No hay campos para actualizar' },
        { status: 400 }
      );
    }

    values.push(id);
    const updated = await querySingle<any>(
      `UPDATE event_shopping_items
         SET ${sets.join(', ')}
         WHERE id = $${idx}
         RETURNING *`,
      values
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Item no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
