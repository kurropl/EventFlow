/**
 * EventFlow — Payment by ID API
 * PATCH  /api/payments/[id] — Update / mark paid
 * DELETE /api/payments/[id] — Remove a payment line
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle } from '@/lib/db';

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
      concept: (v) => String(v),
      amount: (v) => Number(v),
      due_date: (v) => v || null,
      paid: (v) => Boolean(v),
      paid_date: (v) => v || null,
      method: (v) => v || null,
      notes: (v) => v ?? null,
    };
    for (const [key, transform] of Object.entries(allowed)) {
      if (key in body) {
        fields.push(`${key} = $${fields.length + 1}`);
        values.push(transform(body[key]));
      }
    }
    // Auto-stamp paid_date when marking paid without an explicit date
    if (body.paid === true && !('paid_date' in body)) {
      fields.push(`paid_date = $${fields.length + 1}`);
      values.push(new Date().toISOString().slice(0, 10));
    }
    if (body.paid === false && !('paid_date' in body)) {
      fields.push(`paid_date = NULL`);
    }
    if (fields.length === 0) {
      return NextResponse.json({ success: false, error: 'Nada que actualizar' }, { status: 422 });
    }
    values.push(id);
    const updated = await querySingle<any>(
      `UPDATE payments SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Pago no encontrado' }, { status: 404 });
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
    await querySingle<any>(`DELETE FROM payments WHERE id = $1 RETURNING id`, [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
