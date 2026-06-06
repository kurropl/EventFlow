/**
 * Waiters API — EventFlow
 * GET    /api/waiters        — List all waiters
 * POST   /api/waiters        — Upsert waiters (by name, atomic)
 * DELETE /api/waiters?id=xxx — Remove a waiter
 */
import { NextRequest, NextResponse } from 'next/server';
import { query, querySingle, transaction } from '@/lib/db';
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
  name: z.string().min(1, 'name is required').max(200),
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

    // Atomic upsert: find existing by name, update or insert
    const result = await transaction(async (client) => {
      const upserted: Waiter[] = [];
      for (const w of waiters) {
        const existing = await client.query<Waiter>(
          'SELECT id FROM waiters WHERE name = $1',
          [w.name]
        );

        if (existing.rows.length > 0) {
          // Update using the DB id (not the client-sent id)
          const updated = (await client.query<Waiter>(
            'UPDATE waiters SET role = $1, phone = $2 WHERE id = $3 RETURNING *',
            [w.role || null, w.phone || null, existing.rows[0].id]
          )).rows[0];
          if (updated) upserted.push(updated);
        } else {
          const inserted = (await client.query<Waiter>(
            'INSERT INTO waiters (name, role, phone) VALUES ($1, $2, $3) RETURNING *',
            [w.name, w.role || null, w.phone || null]
          )).rows[0];
          if (inserted) upserted.push(inserted);
        }
      }
      return upserted;
    });

    return NextResponse.json({ success: true, waiters: result });
  } catch (e: unknown) {
    console.error('Error saving waiters:', e);
    return NextResponse.json({ error: sanitizeError(e) }, { status: 500 });
  }
}

/**
 * GET /api/waiters
 */
export async function GET() {
  try {
    const result = await query<Waiter>('SELECT * FROM waiters ORDER BY name');
    return NextResponse.json({ success: true, waiters: result.rows });
  } catch (e: unknown) {
    return NextResponse.json({ error: sanitizeError(e) }, { status: 500 });
  }
}

/**
 * DELETE /api/waiters?id=xxx
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const deleted = await querySingle<{ id: string }>(
      'DELETE FROM waiters WHERE id = $1 RETURNING id', [id]
    );
    if (!deleted) return NextResponse.json({ error: 'Waiter not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: sanitizeError(e) }, { status: 500 });
  }
}
