/**
 * EventFlow — Event Plan Item by ID API
 * PATCH /api/event-plans/[id] — Update a plan item (toggle completed, edit fields)
 * DELETE /api/event-plans/[id] — Remove a plan item
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
      title: (v) => String(v),
      description: (v) => v ?? null,
      planned_time: (v) => v ?? null,
      category: (v) => String(v),
      completed: (v) => Boolean(v),
      sort_order: (v) => Number(v),
    };

    for (const [key, transform] of Object.entries(allowed)) {
      if (key in body) {
        fields.push(`${key} = $${fields.length + 1}`);
        values.push(transform(body[key]));
      }
    }

    if (fields.length === 0) {
      return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 422 });
    }

    values.push(id);
    const updated = await querySingle<any>(
      `UPDATE event_plans SET ${fields.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Plan item not found' }, { status: 404 });
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
    await querySingle<any>(`DELETE FROM event_plans WHERE id = $1 RETURNING id`, [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}