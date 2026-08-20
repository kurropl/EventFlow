/**
 * EventFlow — Staffing Workers API Routes
 * GET    /api/staffing/workers         — List all workers (filter by ?role=X&active=true)
 * POST   /api/staffing/workers         — Create a new worker
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { sanitizeError, isValidUUID, sanitizeText } from '@/lib/security';
import { verifyToken, requireAuthRequest } from '@/lib/auth';
import { normalizePhone } from '@/lib/whatsapp';

// ── Auth helper ─────────────────────────────────────────────────────


// ── GET: List workers ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuthRequest(request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const activeParam = searchParams.get('active');

    const conditions: string[] = [];
    const values: (string | boolean)[] = [];
    let idx = 1;

    // Default: only active workers
    if (activeParam !== null) {
      conditions.push(`active = $${idx++}`);
      values.push(activeParam === 'true');
    } else {
      conditions.push(`active = $${idx++}`);
      values.push(true);
    }

    // Filter by role (worker has role in their roles array)
    if (role) {
      conditions.push(`$${idx++} = ANY(roles)`);
      values.push(role);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await queryMany<any>(
      `SELECT id, name, phone, roles, default_uniform, availability,
              active, contract_url, contract_name, created_at, updated_at
       FROM workers
       ${where}
       ORDER BY name ASC`,
      values
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// ── POST: Create a worker ─────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuthRequest(request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }

    const body = await request.json();
    const name = sanitizeText(body.name, 200);
    // Store phone in canonical E.164 (+<digits>) so display is consistent and
    // the WhatsApp webhook can always match the incoming number.
    const rawPhone = sanitizeText(body.phone, 50);
    const phoneDigits = normalizePhone(rawPhone);
    const phone = phoneDigits ? `+${phoneDigits}` : rawPhone;
    const roles = Array.isArray(body.roles) ? body.roles.map((r: string) => sanitizeText(r, 50)).filter(Boolean) : [];

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'El nombre del trabajador es obligatorio.' },
        { status: 422 }
      );
    }
    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'El teléfono del trabajador es obligatorio.' },
        { status: 422 }
      );
    }
    if (roles.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Debe especificar al menos un rol.' },
        { status: 422 }
      );
    }

    const defaultUniform = body.default_uniform ? sanitizeText(body.default_uniform, 200) : null;
    const availability = body.availability ? JSON.stringify(body.availability) : null;

    const created = await querySingle<any>(
      `INSERT INTO workers (name, phone, roles, default_uniform, availability, active)
       VALUES ($1, $2, $3, $4, $${5}, true)
       RETURNING *`,
      [name, phone, roles, defaultUniform, availability ? JSON.parse(availability) : null]
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
