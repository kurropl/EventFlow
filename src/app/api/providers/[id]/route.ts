/**
 * EventFlow — Provider by ID API
 * GET    /api/providers/[id] — Get a single provider
 * PATCH  /api/providers/[id] — Update provider fields
 * DELETE /api/providers/[id] — Delete a provider
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const provider = await querySingle<any>(`SELECT * FROM providers WHERE id = $1`, [id]);
    if (!provider) {
      return NextResponse.json({ success: false, error: 'Proveedor no encontrado' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: provider });
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
      name: (v) => String(v).trim(),
      category: (v) => String(v),
      contact_name: (v) => (v ? String(v).trim() : null),
      phone: (v) => (v ? String(v).trim() : null),
      email: (v) => (v ? String(v).trim() : null),
      notes: (v) => v ?? null,
      active: (v) => Boolean(v),
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
      `UPDATE providers SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Proveedor no encontrado' }, { status: 404 });
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
    const deleted = await querySingle<any>(`DELETE FROM providers WHERE id = $1 RETURNING id`, [id]);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Proveedor no encontrado' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
