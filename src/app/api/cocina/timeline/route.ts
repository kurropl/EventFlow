/**
 * EventFlow — Event Timeline API
 * 
 * GET  /api/cocina/timeline?event_id=xxx — Get timeline for event
 * POST /api/cocina/timeline — Create/update timeline entries
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { verifyToken, verifyAuth } from '@/lib/auth';
import { sanitizeError } from '@/lib/security';


export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    const eventId = new URL(request.url).searchParams.get('event_id');
    if (!eventId) return NextResponse.json({ success: false, error: 'event_id requerido' }, { status: 400 });

    const timeline = await queryMany<any>(
      "SELECT * FROM event_timeline WHERE event_id = $1 ORDER BY orden, planned_time",
      [eventId]
    );

    return NextResponse.json({ success: true, data: timeline });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    const body = await request.json();
    if (!body.event_id || !body.entries || !Array.isArray(body.entries)) {
      return NextResponse.json({ success: false, error: 'event_id y entries requeridos' }, { status: 400 });
    }

    // Delete existing timeline for this event
    await queryMany("DELETE FROM event_timeline WHERE event_id = $1", [body.event_id]);

    // Insert new entries
    const results = [];
    for (const entry of body.entries) {
      const result = await querySingle<any>(
        `INSERT INTO event_timeline (event_id, phase, concepto, planned_time, actual_time, duration_minutes, notes, orden, zona, plato, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         RETURNING *`,
        [
          body.event_id,
          entry.phase,
          entry.concepto,
          entry.planned_time || null,
          entry.actual_time || null,
          entry.duration_minutes || null,
          entry.notes || null,
          entry.orden || 0,
          entry.zona || null,
          entry.plato || null,
        ]
      );
      results.push(result);
    }

    return NextResponse.json({ success: true, data: results }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    const body = await request.json();
    if (!body.id) return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 });

    const result = await querySingle<any>(
      `UPDATE event_timeline SET
        phase = COALESCE($1, phase),
        concepto = COALESCE($2, concepto),
        planned_time = $3,
        actual_time = $4,
        duration_minutes = $5,
        notes = $6,
        orden = COALESCE($7, orden),
        zona = COALESCE($8, zona),
        plato = COALESCE($9, plato)
       WHERE id = $10
       RETURNING *`,
      [body.phase, body.concepto, body.planned_time, body.actual_time, body.duration_minutes, body.notes, body.orden, body.zona, body.plato, body.id]
    );

    if (!result) return NextResponse.json({ success: false, error: 'No encontrado' }, { status: 404 });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}