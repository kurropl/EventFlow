/**
 * EventFlow — Checklist API
 * GET    /api/checklist?event_id=X  — List tasks for an event
 * POST   /api/checklist             — Create custom task
 * PUT    /api/checklist             — Update task (mark completed)
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const event_id = request.nextUrl.searchParams.get('event_id');
    if (!event_id) {
      return NextResponse.json({ success: false, error: 'event_id required' }, { status: 400 });
    }
    const tasks = await queryMany<any>(
      `SELECT * FROM checklist_tasks WHERE event_id = $1 ORDER BY sort_order`,
      [event_id]
    );
    const completed = tasks.filter(t => t.completed).length;
    return NextResponse.json({ success: true, data: tasks, total: tasks.length, completed });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event_id, title, description, hours_before } = body;
    if (!event_id || !title) {
      return NextResponse.json({ success: false, error: 'event_id and title required' }, { status: 400 });
    }
    // Get max sort_order for this event
    const maxRow = await querySingle<any>(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM checklist_tasks WHERE event_id = $1`,
      [event_id]
    );
    const task = await querySingle<any>(
      `INSERT INTO checklist_tasks (event_id, title, description, hours_before, sort_order, custom)
       VALUES ($1, $2, $3, $4, $5, true) RETURNING *`,
      [event_id, title, description || null, hours_before || null, maxRow.next_order]
    );
    return NextResponse.json({ success: true, data: task }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, completed } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
    }
    const task = await querySingle<any>(
      `UPDATE checklist_tasks SET completed = $1, completed_at = CASE WHEN $1 THEN NOW() ELSE NULL END WHERE id = $2 RETURNING *`,
      [completed, id]
    );
    if (!task) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: task });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
