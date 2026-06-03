/**
 * POST /api/waiters
 * Save waiter list (create/update/delete)
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { waiters } = await req.json();

    // Upsert all waiters
    for (const w of waiters) {
      const existing = await query(
        'SELECT id FROM waiters WHERE name = $1',
        [w.name]
      );

      if (existing.rows.length > 0) {
        await query(
          'UPDATE waiters SET name = $1, role = $2 WHERE id = $3',
          [w.name, w.role, w.id]
        );
      } else {
        await query(
          'INSERT INTO waiters (name, role) VALUES ($1, $2)',
          [w.name, w.role]
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Error saving waiters:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/**
 * GET /api/waiters
 * Get all waiters
 */
export async function GET() {
  try {
    const result = await query('SELECT * FROM waiters ORDER BY name');
    return NextResponse.json({ success: true, waiters: result.rows });
  } catch (e: any) {
    console.error('Error getting waiters:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}