/**
 * EventFlow — Bar Config API Route
 * GET /api/bar-config — Return bar prices
 */

import { NextResponse } from 'next/server';
import { queryMany } from '@/lib/db';

export async function GET() {
  try {
    const config = await queryMany<any>(
      `SELECT * FROM bar_config ORDER BY hours ASC`
    );

    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}