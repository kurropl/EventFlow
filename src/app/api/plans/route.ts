/**
 * EventFlow — Table Plans API Routes
 * GET /api/plans?event_id=xxx — Load table plan for an event
 * POST /api/plans — Save/update table plan for an event
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'event_id es requerido' },
        { status: 400 }
      );
    }

    const plans = await queryMany<any>(
      `SELECT id, event_id, name, tables_data, elements_data, budget_data,
              canvas_width, canvas_height, zoom, pan_x, pan_y,
              created_at, updated_at
       FROM table_plans
       WHERE event_id = $1
       ORDER BY updated_at DESC`,
      [eventId]
    );

    return NextResponse.json({ success: true, data: plans });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event_id, name, tables_data, elements_data, budget_data, zoom, pan_x, pan_y } = body;

    if (!event_id) {
      return NextResponse.json(
        { success: false, error: 'event_id es requerido' },
        { status: 400 }
      );
    }

    // Upsert: try to update existing plan, or insert new one
    const existing = await querySingle<any>(
      `SELECT id FROM table_plans WHERE event_id = $1 ORDER BY updated_at DESC LIMIT 1`,
      [event_id]
    );

    let plan;
    if (existing) {
      plan = await querySingle<any>(
        `UPDATE table_plans
         SET name = COALESCE($1, name),
             tables_data = COALESCE($2, tables_data),
             elements_data = COALESCE($3, elements_data),
             budget_data = COALESCE($4, budget_data),
             zoom = COALESCE($5, zoom),
             pan_x = COALESCE($6, pan_x),
             pan_y = COALESCE($7, pan_y)
         WHERE id = $8
         RETURNING *`,
        [
          name ?? null,
          tables_data ? JSON.stringify(tables_data) : null,
          elements_data ? JSON.stringify(elements_data) : null,
          budget_data ? JSON.stringify(budget_data) : null,
          zoom ?? null,
          pan_x ?? null,
          pan_y ?? null,
          existing.id,
        ]
      );
    } else {
      plan = await querySingle<any>(
        `INSERT INTO table_plans (event_id, name, tables_data, elements_data, budget_data, zoom, pan_x, pan_y)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          event_id,
          name || 'Plano principal',
          tables_data ? JSON.stringify(tables_data) : '[]',
          elements_data ? JSON.stringify(elements_data) : '[]',
          budget_data ? JSON.stringify(budget_data) : '{}',
          zoom ?? 1,
          pan_x ?? 100,
          pan_y ?? 100,
        ]
      );
    }

    return NextResponse.json({ success: true, data: plan });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id es requerido' },
        { status: 400 }
      );
    }

    await querySingle(`DELETE FROM table_plans WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}