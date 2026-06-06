/**
 * EventFlow — Lightweight Events API (list view)
 * GET /api/events/light — Minimal fields for panels (no selected_items, no catalog enrichment)
 *
 * Much faster than /api/events: no JSONB payload, no correlated subqueries,
 * uses a single LEFT JOIN aggregation instead of 3 subqueries.
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const email = searchParams.get('email');
    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);

    // ── Lightweight SELECT — no selected_items, no catalog ──────
    let sql = `SELECT e.id, e.client_name, e.client_email, e.client_phone,
      e.event_type, e.event_date, e.guest_count, e.kids_count,
      e.status, e.total_pvp, e.total_cost, e.bar_price,
      e.iva_pct, e.created_at, e.updated_at,
      e.operations_generated_at, e.client_token,
      COALESCE(pay.total_paid, 0)::numeric AS total_paid,
      COALESCE(pay.pending_payments, 0)::int AS pending_payments,
      COALESCE(pay.total_payments, 0)::int AS total_payments
    FROM events e
    LEFT JOIN LATERAL (
      SELECT
        SUM(amount) FILTER (WHERE paid = true) AS total_paid,
        COUNT(*) FILTER (WHERE paid = false) AS pending_payments,
        COUNT(*) AS total_payments
      FROM payments WHERE event_id = e.id
    ) pay ON true`;

    const params: any[] = [];
    const conds: string[] = [];

    if (status) {
      conds.push(`e.status = $${params.length + 1}`);
      params.push(status);
    }
    if (email) {
      const safeEmail = email.replace(/[%_]/g, (ch) => '\\' + ch);
      conds.push(`e.client_email ILIKE $${params.length + 1}`);
      params.push(`%${safeEmail}%`);
    }
    if (search) {
      conds.push(`(e.client_name ILIKE $${params.length + 1} OR e.client_email ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }

    if (conds.length > 0) sql += ` WHERE ${conds.join(' AND ')}`;
    sql += ` ORDER BY e.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const events = await queryMany<any>(sql, params);

    // Count for pagination
    const countSql = `SELECT COUNT(*)::int as count FROM events e${conds.length > 0 ? ' WHERE ' + conds.join(' AND ') : ''}`;
    const countResult = await querySingle<any>(countSql, params.slice(0, conds.length));

    // Cache header: 30s stale, 60s max (panel data changes infrequently)
    return NextResponse.json(
      {
        success: true,
        data: events,
        pagination: {
          total: countResult?.count ?? 0,
          limit,
          offset,
          hasMore: offset + limit < (countResult?.count ?? 0),
        },
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}
