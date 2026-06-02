/**
 * EventFlow — Event Plans API
 * GET  /api/event-plans?event_id=X — List plan items for an event
 * POST /api/event-plans          — Create a new plan item
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');

    if (!eventId) {
      return NextResponse.json({ success: false, error: 'event_id is required' }, { status: 400 });
    }

    const items = await queryMany<any>(
      `SELECT * FROM event_plans WHERE event_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [eventId]
    );

    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.event_id || !body.title) {
      return NextResponse.json({ success: false, error: 'event_id and title are required' }, { status: 422 });
    }

    const item = await querySingle<any>(
      `INSERT INTO event_plans (event_id, title, description, planned_time, category, completed)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        body.event_id,
        body.title,
        body.description ?? null,
        body.planned_time ?? null,
        body.category ?? 'general',
        Boolean(body.completed),
      ]
    );

    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}