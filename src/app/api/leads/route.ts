/**
 * EventFlow — Leads API
 * GET    /api/leads       — List all leads (with optional search/filter)
 * POST   /api/leads       — Create a new lead manually
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { sanitizeError } from '@/lib/security';
import { z } from 'zod';

// ── Types ───────────────────────────────────────────────────────

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  status: string;
  notes: string | null;
  event_type: string | null;
  guest_count: number | null;
  event_date: string | null;
  created_at: string;
  updated_at: string;
}

// ── Validation ──────────────────────────────────────────────────

const CreateLeadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format').optional().or(z.literal('')).nullable(),
  phone: z.string().optional().nullable(),
  source: z.string().optional(),
  event_type: z.string().optional().nullable(),
  guest_count: z.number().int().positive('Guest count must be > 0').optional().nullable(),
  event_date: z.string().optional().nullable(),
});

// ── Handlers ────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);

    let sql = `SELECT l.*, 
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id',q.id,'status',q.status,'total_pvp',q.total_pvp))
       FROM quotes q WHERE q.lead_id = l.id), '[]'::jsonb) AS quotes
      FROM leads l`;
    const params: (string | number)[] = [];
    const conds: string[] = [];

    if (status) {
      conds.push(`l.status = $${params.length + 1}`);
      params.push(status);
    }
    if (search) {
      conds.push(`(l.name ILIKE $${params.length + 1} OR l.email ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }

    if (conds.length > 0) sql += ` WHERE ${conds.join(' AND ')}`;
    sql += ` ORDER BY l.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const rows = await queryMany<Lead>(sql, params);
    return NextResponse.json({ data: rows });
  } catch (error) {
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateLeadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Validation error' },
        { status: 400 }
      );
    }

    const { name, email, phone, source, event_type, guest_count, event_date } = parsed.data;

    const lead = await querySingle<Lead>(
      `INSERT INTO leads (name, email, phone, source, event_type, guest_count, event_date)
       VALUES ($1, $2, $3, COALESCE($4, 'manual'), $5, $6, $7)
       RETURNING *`,
      [name, email || null, phone || null, source || 'manual', event_type || null, guest_count || null, event_date || null]
    );

    return NextResponse.json({ data: lead }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}
