/**
 * EventFlow — Proposed Menus API Route
 * GET /api/proposed-menus — Return all proposed menus
 */

import { NextResponse } from 'next/server';
import { queryMany } from '@/lib/db';

export async function GET() {
  try {
    const menus = await queryMany<any>(
      `SELECT * FROM proposed_menus ORDER BY suggested_price ASC`
    );

    return NextResponse.json({ success: true, data: menus });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}