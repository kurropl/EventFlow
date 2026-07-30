/**
 * EventFlow — Stock (Ingredients) API Routes
 * GET    /api/stock         — List ingredients with stock levels (search by name/supplier)
 * POST   /api/stock         — Create a new ingredient
 * PUT    /api/stock         — Update an ingredient (quantity, min_stock, cost_per_unit, etc.)
 * DELETE /api/stock         — Soft-delete an ingredient (set active = false)
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { sanitizeError, isValidUUID, sanitizeText, toSafeFloat } from '@/lib/security';
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

// ── GET: List ingredients with stock levels ─────────────────────────

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
    const search = searchParams.get('search')?.trim();
    const showAll = searchParams.get('all') === 'true';
    const lowStockOnly = searchParams.get('low_stock') === 'true';

    const conditions: string[] = [];
    const values: (string | boolean | number)[] = [];
    let idx = 1;

    // By default only show active ingredients
    if (!showAll) {
      conditions.push(`active = $${idx++}`);
      values.push(true);
    }

    // Search by name or supplier
    if (search) {
      conditions.push(`(name ILIKE $${idx} OR supplier ILIKE $${idx})`);
      values.push(`%${search}%`);
      idx++;
    }

    // Low stock filter: quantity <= min_stock
    if (lowStockOnly) {
      conditions.push(`quantity <= min_stock`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await queryMany<any>(
      `SELECT id, name, unit, base_unit, cost_per_unit, supplier, active,
              quantity, min_stock, last_restocked, created_at, updated_at
       FROM ingredients
       ${where}
       ORDER BY name ASC`,
      values
    );

    // Enrich with low_stock flag
    const enriched = rows.map((row) => ({
      ...row,
      low_stock: row.min_stock != null && row.quantity != null
        ? Number(row.quantity) <= Number(row.min_stock)
        : false,
    }));

    return NextResponse.json({ success: true, data: enriched });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// ── POST: Create a new ingredient ──────────────────────────────────

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
    const name = sanitizeText(body.name, 200);
    if (!name) {
      return NextResponse.json(
        { success: false, error: 'El nombre del ingrediente es obligatorio.' },
        { status: 422 }
      );
    }

    const unit = sanitizeText(body.unit || 'kg', 50);
    // WP-01: base_unit es la unidad base del ingrediente ('g', 'ml', 'ud')
    const baseUnit = ['g', 'ml', 'ud'].includes(body.base_unit) ? body.base_unit : 'ud';
    const supplier = body.supplier ? sanitizeText(body.supplier, 200) : null;
    const costPerUnit = body.cost_per_unit != null ? toSafeFloat(body.cost_per_unit, 0, 999999) : 0;
    const quantity = body.quantity != null ? toSafeFloat(body.quantity, 0, 999999) : 0;
    const minStock = body.min_stock != null ? toSafeFloat(body.min_stock, 0, 999999) : 0;
    const active = body.active !== undefined ? Boolean(body.active) : true;

    const created = await querySingle<any>(
      `INSERT INTO ingredients (name, unit, base_unit, cost_per_unit, supplier, quantity, min_stock, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [name, unit, baseUnit, costPerUnit, supplier, quantity, minStock, active]
    );

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// ── PUT: Update an ingredient ──────────────────────────────────────

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
    const id = body.id;
    if (!id || !isValidUUID(id)) {
      return NextResponse.json(
        { success: false, error: 'id inválido.' },
        { status: 422 }
      );
    }

    // Whitelist of allowed fields with sanitizers
    const allowed: Record<string, { transform: (v: any) => any; allowZero?: boolean }> = {
      name:        { transform: (v) => sanitizeText(String(v), 200) },
      unit:        { transform: (v) => sanitizeText(String(v), 50) },
      base_unit:   { transform: (v) => ['g', 'ml', 'ud'].includes(v) ? v : 'ud' },  // WP-01
      cost_per_unit: { transform: (v) => toSafeFloat(v, 0, 999999) },
      supplier:    { transform: (v) => sanitizeText(String(v), 200) || null },
      quantity:    { transform: (v) => toSafeFloat(v, 0, 999999) },
      min_stock:   { transform: (v) => toSafeFloat(v, 0, 999999) },
      active:      { transform: (v) => Boolean(v) },
    };

    const sets: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, { transform }] of Object.entries(allowed)) {
      if (key in body && body[key] !== undefined) {
        sets.push(`${key} = $${idx}`);
        values.push(transform(body[key]));
        idx++;
      }
    }

    // Also allow updating last_restocked on manual restock
    if ('last_restocked' in body) {
      sets.push(`last_restocked = $${idx}`);
      values.push(body.last_restocked ? new Date(body.last_restocked) : null);
      idx++;
    }

    if (sets.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nada que actualizar.' },
        { status: 400 }
      );
    }

    values.push(id);
    const updated = await querySingle<any>(
      `UPDATE ingredients SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Ingrediente no encontrado.' },
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

// ── DELETE: Soft-delete an ingredient ──────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id || !isValidUUID(id)) {
      return NextResponse.json(
        { success: false, error: 'id inválido.' },
        { status: 422 }
      );
    }

    const updated = await querySingle<any>(
      `UPDATE ingredients SET active = false WHERE id = $1 AND active = true RETURNING id`,
      [id]
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Ingrediente no encontrado o ya desactivado.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
