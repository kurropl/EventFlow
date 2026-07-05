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
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Atomic upsert: prefer matching by the real DB id (renombrar dos veces
    // seguidas usaba WHERE name = $1, así que el segundo guardado ya no
    // encontraba el nombre viejo y creaba una fila nueva huérfana). El id
    // que envía el cliente para camareros recién creados en el navegador
    // (`w${Date.now()}`) no es un UUID real, así que en ese caso se hace
    // fallback al match por nombre — solo entonces es correcto insertar.
    const result = await transaction(async (client) => {
      const upserted: Waiter[] = [];
      for (const w of waiters) {
        let existingId: string | null = null;

        if (w.id && UUID_RE.test(w.id)) {
          const byId = await client.query<Waiter>('SELECT id FROM waiters WHERE id = $1', [w.id]);
          if (byId.rows.length > 0) existingId = byId.rows[0].id;
        }
        if (!existingId) {
          const byName = await client.query<Waiter>('SELECT id FROM waiters WHERE name = $1', [w.name]);
          if (byName.rows.length > 0) existingId = byName.rows[0].id;
        }

        if (existingId) {
          const updated = (await client.query<Waiter>(
            'UPDATE waiters SET name = $1, role = $2, phone = $3 WHERE id = $4 RETURNING *',
            [w.name, w.role || null, w.phone || null, existingId]
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
