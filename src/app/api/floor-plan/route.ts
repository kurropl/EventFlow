/**
 * EventFlow — Floor Plan API
 * GET  /api/floor-plan  — Load default hall layout
 * POST /api/floor-plan  — Save hall layout (tables)
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany } from '@/lib/db';

export async function GET() {
  try {
    const rows = await queryMany<any>('SELECT layout_id, layout_data, label FROM floor_plans WHERE is_default = true LIMIT 1');
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
    const { tables, label } = body;

    if (!Array.isArray(tables)) {
      return NextResponse.json({ error: 'Tables array is required' }, { status: 400 });
    }

    // Upsert default layout
    const existing = await queryMany<any>('SELECT layout_id FROM floor_plans WHERE is_default = true LIMIT 1');
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

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}