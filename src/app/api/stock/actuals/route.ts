/**
 * EventFlow — Actuals API
 * PUT /api/stock/actuals — Save actual quantities for escandallo items
 */

import { NextRequest, NextResponse } from 'next/server';
import { transaction } from '@/lib/db';
import { sanitizeError, sanitizeText } from '@/lib/security';
import { verifyToken, requireAuthRequest } from '@/lib/auth';

// ── Auth helper ─────────────────────────────────────────────────────


// ── PUT: Save actual quantities for escandallo items ────────────────

export async function PUT(request: NextRequest) {
  try {
    const auth = requireAuthRequest(request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { items } = body as {
      items?: Array<{
        id: string;
        actual_quantity?: number;
        actual_unit?: string;
        actual_cost?: number;
        notes?: string;
      }>;
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Se requiere al menos un item' },
        { status: 422 }
      );
    }

    // Update each item inside a transaction
    const updated = await transaction(async (client) => {
      const results: any[] = [];

      for (const item of items) {
        if (!item.id) continue;

        const sets: string[] = [];
        const values: (string | number | null)[] = [];
        let idx = 1;

        if (item.actual_quantity !== undefined) {
          sets.push(`actual_quantity = $${idx++}`);
          values.push(item.actual_quantity);
        }
        if (item.actual_unit !== undefined) {
          sets.push(`actual_unit = $${idx++}`);
          values.push(sanitizeText(item.actual_unit, 50));
        }
        if (item.actual_cost !== undefined) {
          sets.push(`actual_cost = $${idx++}`);
          values.push(item.actual_cost);
        }
        if (item.notes !== undefined) {
          sets.push(`notes = $${idx++}`);
          values.push(item.notes ? sanitizeText(item.notes, 500) : null);
        }

        if (sets.length === 0) continue;

        values.push(item.id);
        const result = await client.query(
          `UPDATE event_shopping_items
           SET ${sets.join(', ')}, updated_at = now()
           WHERE id = $${idx}
           RETURNING *`,
          values
        );

        if (result.rows?.[0]) {
          results.push(result.rows[0]);
        }
      }

      return results;
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
