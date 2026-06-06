/**
 * EventFlow — Providers API
 * GET  /api/providers — List all providers (optional ?category=, ?active=true)
 * POST /api/providers — Create a new provider
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { sanitizeError } from '@/lib/security';
import { z } from 'zod';

// ── Types ───────────────────────────────────────────────────────

interface Provider {
  id: string;
  name: string;
  category: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Validation ──────────────────────────────────────────────────

const CreateProviderSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  category: z.string().optional(),
  contact_name: z.string().max(200).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email('Invalid email format').optional().nullable(),
  notes: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

// ── Handlers ────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const active = searchParams.get('active');

    const conditions: string[] = [];
    const values: (string | boolean)[] = [];
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
    const rows = await queryMany<Provider>(
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
    const parsed = CreateProviderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Validation error' },
        { status: 400 }
      );
    }

    const { name, category, contact_name, phone, email, notes, active } = parsed.data;

    const created = await querySingle<Provider>(
      `INSERT INTO providers (name, category, contact_name, phone, email, notes, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name.trim(), category || 'otro', contact_name, phone, email, notes, active !== undefined ? active : true]
    );

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
