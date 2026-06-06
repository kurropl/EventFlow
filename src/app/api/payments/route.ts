/**
 * EventFlow — Payments (Cobros) API
 * GET  /api/payments?event_id= — List payments (optionally for one event), with event context
 * POST /api/payments — Create a payment / cobro line
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { sanitizeError } from '@/lib/security';
import { z } from 'zod';

// ── Types ───────────────────────────────────────────────────────

interface Payment {
  id: string;
  event_id: string;
  concept: string;
  amount: number;
  due_date: string | null;
  paid: boolean;
  paid_date: string | null;
  method: string | null;
  notes: string | null;
  created_at: string;
  // Joined fields
  client_name?: string;
  event_date?: string;
  event_type?: string;
}

// ── Validation ──────────────────────────────────────────────────

const CreatePaymentSchema = z.object({
  event_id: z.string().uuid('event_id must be a valid UUID'),
  amount: z.number().positive('amount must be > 0'),
  concept: z.string().max(200).optional(),
  due_date: z.string().optional().nullable(),
  paid: z.boolean().optional(),
  paid_date: z.string().optional().nullable(),
  method: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// ── Handlers ────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');
    const params: string[] = [];
    let where = '';
    if (eventId) {
      params.push(eventId);
      where = `WHERE p.event_id = $1`;
    }
    const rows = await queryMany<Payment>(
      `SELECT p.*, e.client_name, e.event_date, e.event_type
       FROM payments p
       JOIN events e ON e.id = p.event_id
       ${where}
       ORDER BY p.paid ASC, p.due_date ASC NULLS LAST, p.created_at ASC`,
      params
    );
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreatePaymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Validation error' },
        { status: 400 }
      );
    }

    const { event_id, amount, concept, due_date, paid, paid_date, method, notes } = parsed.data;

    const created = await querySingle<Payment>(
      `INSERT INTO payments (event_id, concept, amount, due_date, paid, paid_date, method, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        event_id,
        (concept ?? 'Pago').trim() || 'Pago',
        amount,
        due_date || null,
        Boolean(paid),
        paid ? (paid_date || new Date().toISOString().slice(0, 10)) : null,
        method || null,
        notes ?? null,
      ]
    );
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
