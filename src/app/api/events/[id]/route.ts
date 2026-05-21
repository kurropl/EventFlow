/**
 * EventFlow — Event by ID API Route
 * GET /api/events/[id] — Get single event
 * PUT /api/events/[id] — Update event (status, details)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { querySingle } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const event = await querySingle<any>(
      `SELECT * FROM events WHERE id = $1`,
      [id]
    );

    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: event });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, notes, total_pvp, total_cost, bar_hours } = body;

    const event = await querySingle<any>(
      `UPDATE events
       SET status = COALESCE($1, status),
           notes = COALESCE($2, notes),
           total_pvp = COALESCE($3, total_pvp),
           total_cost = COALESCE($4, total_cost),
           bar_hours = COALESCE($5, bar_hours)
       WHERE id = $6
       RETURNING *`,
      [status ?? null, notes ?? null, total_pvp ?? null, total_cost ?? null, bar_hours ?? null, id]
    );

    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: event });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}