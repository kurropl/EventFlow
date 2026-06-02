/**
 * EventFlow — Event Plans API Routes
 * GET  /api/event-plans?event_id=X — List plan items for an event
 * POST /api/event-plans          — Create a new plan item
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { queryMany, querySingle } from '@/lib/db';

// ============================================================
// Validation
// ============================================================

const CreatePlanItemSchema = z.object({
  event_id: z.string().uuid('event_id must be a valid UUID'),
  title: z.string().min(1, 'title is required').max(255),
  description: z.string().nullable().optional(),
  planned_time: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  completed: z.boolean().default(false),
});

// ============================================================
// GET — List plan items for an event
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');
    const category = searchParams.get('category');
    const completed = searchParams.get('completed');

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'event_id is required' },
        { status: 400 }
      );
    }

    let query = `SELECT * FROM event_plans WHERE event_id = $1`;
    const params: any[] = [eventId];
    const conditions: string[] = [];

    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }
    if (completed === 'true' || completed === 'false') {
      params.push(completed === 'true');
      conditions.push(`completed = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ` AND ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY created_at ASC`;

    const items = await queryMany<any>(query, params);

    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// ============================================================
// POST — Create a new plan item
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = CreatePlanItemSchema.parse(body);

    const item = await querySingle<any>(
      `INSERT INTO event_plans (event_id, title, description, planned_time, category, completed)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        validated.event_id,
        validated.title,
        validated.description ?? null,
        validated.planned_time ?? null,
        validated.category ?? null,
        validated.completed,
      ]
    );

    if (!item) {
      throw new Error('Failed to create plan item: no data returned');
    }

    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 422 }
      );
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
