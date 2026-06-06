/**
 * POST /api/waiters
 * Save waiter list (create/update/delete)
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sanitizeError } from '@/lib/security';
import { z } from 'zod';

// ── Types ───────────────────────────────────────────────────────

interface Waiter {
  id: string;
  name: string;
  role: string | null;
}

// ── Validation ──────────────────────────────────────────────────

const WaiterInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'name is required'),
  phone: z.string().optional().nullable(),
  role: z.string().optional().nullable(),
});

const WaitersPostSchema = z.object({
  waiters: z.array(WaiterInputSchema).min(1, 'At least one waiter is required'),
});

// ── Handlers ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = WaitersPostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Validation error' },
        { status: 400 }
      );
    }

    const { waiters } = parsed.data;

    // Upsert all waiters
    for (const w of waiters) {
      const existing = await query<Waiter>(
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
  } catch (e: unknown) {
    console.error('Error saving waiters:', e);
    return NextResponse.json({ error: sanitizeError(e) }, { status: 500 });
  }
}

/**
 * GET /api/waiters
 * Get all waiters
 */
export async function GET() {
  try {
    const result = await query<Waiter>('SELECT * FROM waiters ORDER BY name');
    return NextResponse.json({ success: true, waiters: result.rows });
  } catch (e: unknown) {
    console.error('Error getting waiters:', e);
    return NextResponse.json({ error: sanitizeError(e) }, { status: 500 });
  }
}
