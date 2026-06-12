/**
 * EventFlow — Checklist Init
 * POST /api/checklist/init — Create tasks from templates for an event
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event_id, event_type } = body;
    if (!event_id || !event_type) {
      return NextResponse.json({ success: false, error: 'event_id and event_type required' }, { status: 400 });
    }

    // Check if tasks already exist
    const existing = await querySingle<any>(
      `SELECT COUNT(*)::int AS count FROM checklist_tasks WHERE event_id = $1`, [event_id]
    );
    if (existing && existing.count > 0) {
      return NextResponse.json({ success: true, data: [], message: 'Tasks already initialized' });
    }

    // Load templates for this event type
    const templates = await queryMany<any>(
      `SELECT * FROM checklist_templates WHERE event_type = $1 ORDER BY sort_order`, [event_type]
    );
    if (templates.length === 0) {
      return NextResponse.json({ success: false, error: `No templates found for event type: ${event_type}` }, { status: 404 });
    }

    // Create tasks from templates
    const created = [];
    for (const t of templates) {
      const task = await querySingle<any>(
        `INSERT INTO checklist_tasks (event_id, template_id, title, description, hours_before, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [event_id, t.id, t.title, t.description, t.hours_before, t.sort_order]
      );
      created.push(task);
    }

    return NextResponse.json({ success: true, data: created, count: created.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
