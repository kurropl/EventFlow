/**
 * EventFlow — Client by ID API
 * GET    /api/clients/[id] — Client + their event history
 * PATCH  /api/clients/[id] — Update client fields
 * DELETE /api/clients/[id] — Delete a client row (events are kept)
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = await querySingle<any>(`SELECT * FROM clients WHERE id = $1`, [id]);
    if (!client) {
      return NextResponse.json({ success: false, error: 'Cliente no encontrado' }, { status: 404 });
    }
    const events = await queryMany<any>(
      `SELECT id, event_type, guest_count, kids_count, event_date, status, total_pvp
       FROM events
       WHERE client_id = $1 OR lower(client_email) = lower($2)
       ORDER BY event_date DESC`,
      [id, client.email ?? '']
    );
    return NextResponse.json({ success: true, data: { ...client, events } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const fields: string[] = [];
    const values: any[] = [];
    const allowed: Record<string, (v: any) => any> = {
      name: (v) => String(v),
      email: (v) => (v ? String(v) : null),
      phone: (v) => (v ? String(v) : null),
      company: (v) => (v ? String(v) : null),
      notes: (v) => v ?? null,
      tags: (v) => JSON.stringify(Array.isArray(v) ? v : []),
    };
    for (const [key, transform] of Object.entries(allowed)) {
      if (key in body) {
        fields.push(`${key} = $${fields.length + 1}`);
        values.push(transform(body[key]));
      }
    }
    if (fields.length === 0) {
      return NextResponse.json({ success: false, error: 'Nada que actualizar' }, { status: 422 });
    }
    values.push(id);
    const updated = await querySingle<any>(
      `UPDATE clients SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Cliente no encontrado' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await querySingle<any>(`DELETE FROM clients WHERE id = $1 RETURNING id`, [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
