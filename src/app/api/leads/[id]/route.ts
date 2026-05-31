/**
 * EventFlow — Single Lead API
 * GET  /api/leads/[id]       — Get lead by ID
 * PUT  /api/leads/[id]       — Update lead (status, notes, etc.)
 * POST /api/leads/[id]/convert — Convert lead → client (accept quote)
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const lead = await querySingle<any>(
      `SELECT l.*, 
        (SELECT jsonb_agg(jsonb_build_object('id',q.id,'status',q.status,'total_pvp',q.total_pvp,'created_at',q.created_at))
         FROM quotes q WHERE q.lead_id = l.id) AS quotes
       FROM leads l WHERE l.id = $1`,
      [params.id]
    );
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    return NextResponse.json({ data: lead });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { status, notes } = body;

    const lead = await querySingle<any>(
      `UPDATE leads SET 
        status = COALESCE($1, status),
        notes = COALESCE($2, notes)
       WHERE id = $3 RETURNING *`,
      [status || null, notes !== undefined ? notes : null, params.id]
    );
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    // If status = 'convertido', also create/update the client record
    if (status === 'convertido') {
      const { fiscal_name, fiscal_nif, fiscal_address } = body;
      if (!fiscal_name || !fiscal_nif) {
        return NextResponse.json({ error: 'fiscal_name and fiscal_nif required for conversion' }, { status: 400 });
      }

      // Upsert client
      const client = await querySingle<any>(
        `INSERT INTO clients (name, email, phone, fiscal_name, fiscal_nif, fiscal_address, lead_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (fiscal_nif) DO UPDATE SET
          name = EXCLUDED.name, email = EXCLUDED.email, phone = EXCLUDED.phone,
          fiscal_name = EXCLUDED.fiscal_name, fiscal_address = EXCLUDED.fiscal_address
         RETURNING *`,
        [lead.name, lead.email, lead.phone, fiscal_name, fiscal_nif, fiscal_address || null, params.id]
      );

      // Link lead to client
      await querySingle(
        `UPDATE leads SET converted_to_client_id = $1 WHERE id = $2`,
        [client.id, params.id]
      );

      return NextResponse.json({ data: { lead, client } });
    }

    return NextResponse.json({ data: lead });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
