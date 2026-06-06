/**
 * EventFlow — Providers API
 * GET  /api/providers — List all providers (optional ?category=, ?active=true)
 * POST /api/providers — Create a new provider
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const active = searchParams.get('active');

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (category) {
      conditions.push(`category = $${idx++}`);
      values.push(category);
    }
    if (active !== null && active !== '') {
      conditions.push(`active = $${idx++}`);
      values.push(active === 'true');
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await queryMany<any>(
      `SELECT * FROM providers ${where} ORDER BY name ASC`,
      values
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = (body.name ?? '').trim();
    if (!name) {
      return NextResponse.json({ success: false, error: 'El nombre es obligatorio' }, { status: 422 });
    }

    const category = body.category ?? 'otro';
    const contact_name = body.contact_name ? String(body.contact_name).trim() : null;
    const phone = body.phone ? String(body.phone).trim() : null;
    const email = body.email ? String(body.email).trim() : null;
    const notes = body.notes ?? null;
    const active = body.active !== undefined ? Boolean(body.active) : true;

    const created = await querySingle<any>(
      `INSERT INTO providers (name, category, contact_name, phone, email, notes, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, category, contact_name, phone, email, notes, active]
    );

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
