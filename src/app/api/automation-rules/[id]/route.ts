/**
 * EventFlow — Automation Rules Detail API
 * GET    /api/automation-rules/[id] — get a single rule
 * PUT    /api/automation-rules/[id] — update a rule
 * DELETE /api/automation-rules/[id] — delete a rule
 */

import { NextResponse } from 'next/server';
import { getRule, updateRule, deleteRule } from '@/lib/automation';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rule = await getRule(id);
    if (!rule) {
      return NextResponse.json(
        { success: false, error: 'Rule not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: rule });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate
    if (body.name !== undefined && (typeof body.name !== 'string' || body.name.trim().length < 2)) {
      return NextResponse.json(
        { success: false, error: 'Name must be at least 2 characters' },
        { status: 400 }
      );
    }

    const updated = await updateRule(id, {
      ...body,
      name: body.name?.trim(),
      description: body.description?.trim(),
      conditions: Array.isArray(body.conditions) ? body.conditions : undefined,
      actions: Array.isArray(body.actions) ? body.actions : undefined,
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Rule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = await deleteRule(id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Rule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
