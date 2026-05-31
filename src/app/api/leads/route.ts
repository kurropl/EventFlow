/**
 * EventFlow — Leads API
 * GET    /api/leads       — List all leads (with optional search/filter)
 * POST   /api/leads       — Create a new lead manually
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';

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
    const params: any[] = [];
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

    const rows = await queryMany<any>(sql, params);
    return NextResponse.json({ data: rows });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, source, event_type, guest_count, event_date } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const lead = await querySingle<any>(
      `INSERT INTO leads (name, email, phone, source, event_type, guest_count, event_date)
       VALUES ($1, $2, $3, COALESCE($4, 'manual'), $5, $6, $7)
       RETURNING *`,
      [name, email || null, phone || null, source || 'manual', event_type || null, guest_count || null, event_date || null]
    );

    return NextResponse.json({ data: lead }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}