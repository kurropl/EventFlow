/**
 * GET /api/mapa-mesas/[eventId] — Cargar plano de mesas
 * PUT /api/mapa-mesas/[eventId] — Guardar plano de mesas
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

export async function GET(
  _req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const result = await query(
      `SELECT name, data, updated_at FROM event_floorplans WHERE event_id = $1 LIMIT 1`,
      [params.eventId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, data: null });
    }

    const row = result.rows[0];
    return NextResponse.json({
      success: true,
      data: {
        name: row.name,
        tables: (row.data as any)?.tables || [],
        elements: (row.data as any)?.elements || [],
        updatedAt: row.updated_at,
      },
    });
  } catch (e: unknown) {
    console.error('Error loading floor plan:', e);
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const body = await req.json();
    const { name, tables, elements } = body;

    const data = JSON.stringify({ tables: tables || [], elements: elements || [] });
    const planName = name || 'Salón de Celebraciones';

    await query(
      `INSERT INTO event_floorplans (event_id, name, data, updated_at)
       VALUES ($1, $2, $3::jsonb, NOW())
       ON CONFLICT (event_id)
       DO UPDATE SET name = $2, data = $3::jsonb, updated_at = NOW()`,
      [params.eventId, planName, data]
    );

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    console.error('Error saving floor plan:', e);
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}