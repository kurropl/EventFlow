import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const extras = await queryMany<any>(
      'SELECT ee.*, ec.name as extra_name, ec.price FROM event_extras ee JOIN extras_catalog ec ON ec.id = ee.extra_id WHERE ee.event_id = $1',
      [id]
    );
    return NextResponse.json({ success: true, data: extras });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { extra_id, qty } = body;
    const result = await querySingle<any>(
      'INSERT INTO event_extras (event_id, extra_id, qty, price_snapshot, selected_via) VALUES ($1, $2, $3, (SELECT price FROM extras_catalog WHERE id = $2), $4) RETURNING *',
      [id, extra_id, qty || 1, 'admin']
    );
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
