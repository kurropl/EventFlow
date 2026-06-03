/** EventFlow — Floor Plan API with event-scoped layouts */
import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const eventId = request.nextUrl.searchParams.get('event_id');
    
    if (eventId) {
      // Load per-event table plan
      const rows = await queryMany<any>(
        `SELECT id, name, tables_data, events.name AS event_name
         FROM table_plans
         JOIN events ON events.id = table_plans.event_id
         WHERE event_id = $1
         ORDER BY updated_at DESC LIMIT 1`,
        [eventId]
      );
      if (rows.length > 0) {
        return NextResponse.json({ success: true, data: rows[0].tables_data, event_id: eventId, plan_id: rows[0].id });
      }
      // Fallback: return default layout if no event-specific plan exists
      const defaults = await queryMany<any>(
        `SELECT layout_data FROM floor_plans WHERE is_default = true LIMIT 1`
      );
      if (defaults.length > 0) {
        return NextResponse.json({ success: true, data: defaults[0].layout_data, event_id: eventId, is_default: true });
      }
      return NextResponse.json({ success: true, data: null, event_id: eventId });
    }

    // No event_id: load default layout
    const rows = await queryMany<any>(
      'SELECT layout_id, layout_data, label FROM floor_plans WHERE is_default = true LIMIT 1'
    );
    if (rows.length > 0) {
      return NextResponse.json({ success: true, data: rows[0].layout_data, label: rows[0].label });
    }
    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tables, event_id, label } = body;

    if (!Array.isArray(tables)) {
      return NextResponse.json({ error: 'Tables array is required' }, { status: 400 });
    }

    if (event_id) {
      // Upsert event-specific table plan
      const existing = await queryMany<any>(
        'SELECT id FROM table_plans WHERE event_id = $1 ORDER BY updated_at DESC LIMIT 1',
        [event_id]
      );
      if (existing.length > 0) {
        await querySingle(
          `UPDATE table_plans SET tables_data = $1::jsonb, updated_at = now() WHERE id = $2`,
          [JSON.stringify(tables), existing[0].id]
        );
      } else {
        await querySingle(
          `INSERT INTO table_plans (event_id, name, tables_data) VALUES ($1, $2, $3::jsonb)`,
          [event_id, label || 'Plano principal', JSON.stringify(tables)]
        );
      }
    } else {
      // Upsert default layout
      const existing = await queryMany<any>(
        'SELECT layout_id FROM floor_plans WHERE is_default = true LIMIT 1'
      );
      if (existing.length > 0) {
        await querySingle(
          `UPDATE floor_plans SET layout_data = $1::jsonb, label = COALESCE($2, label), updated_at = now() WHERE is_default = true`,
          [JSON.stringify(tables), label || 'Default hall layout']
        );
      } else {
        await querySingle(
          `INSERT INTO floor_plans (layout_data, label, is_default) VALUES ($1::jsonb, $2, true)`,
          [JSON.stringify(tables), label || 'Default hall layout']
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}