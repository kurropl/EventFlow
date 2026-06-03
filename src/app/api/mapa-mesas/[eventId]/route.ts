/**
 * GET /api/mapa-mesas/[eventId]
 * Load floor plan for an event
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const result = await query(
      `SELECT data FROM event_floorplans WHERE event_id = $1 ORDER BY updated_at DESC LIMIT 1`,
      [params.eventId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false });
    }

    const data = result.rows[0].data;
    return NextResponse.json({
      success: true,
      tables: data.tables || [],
      elements: data.elements || [],
      eventName: data.eventName || '',
      budget: data.budget || {},
    });
  } catch (e: any) {
    console.error('Error loading floor plan:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
