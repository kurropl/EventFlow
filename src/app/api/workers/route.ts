/**
 * EventFlow — Workers API (for transport drivers)
 * GET /api/workers — List all workers (for driver selection)
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany } from '@/lib/db';

export async function GET(_request: NextRequest) {
  try {
    const workers = await queryMany<any>(
      `SELECT id, name, phone, role, active
       FROM workers
       WHERE active = true
       ORDER BY name ASC`
    );

    return NextResponse.json({ success: true, data: workers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
