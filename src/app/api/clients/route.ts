/**
 * EventFlow — Clients (CRM) API
 * GET  /api/clients — Merged list: clients table + contacts derived from events
 * POST /api/clients — Upsert a client (matched by email when provided)
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

export async function GET() {
  try {
    const rows = await queryMany<any>(
      `SELECT
         c.id                          AS client_id,
         COALESCE(c.name, agg.name)    AS name,
         COALESCE(c.email, agg.email)  AS email,
         COALESCE(c.phone, agg.phone)  AS phone,
         c.company,
         c.tags,
         c.notes,
         COALESCE(agg.event_count, 0)  AS event_count,
         COALESCE(agg.total_value, 0)  AS total_value,
         agg.last_event,
         agg.first_event
       FROM clients c
       FULL OUTER JOIN (
         SELECT
           lower(client_email) AS email_key,
           max(client_name)    AS name,
           max(client_email)   AS email,
           max(client_phone)   AS phone,
           count(*)            AS event_count,
           sum(total_pvp)      AS total_value,
           max(event_date)     AS last_event,
           min(event_date)     AS first_event
         FROM events
         WHERE client_email IS NOT NULL AND client_email <> ''
         GROUP BY lower(client_email)
       ) agg ON lower(c.email) = agg.email_key
       ORDER BY agg.last_event DESC NULLS LAST, name ASC`
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
    const name = (body.name ?? '').trim();
    if (!name) {
      return NextResponse.json({ success: false, error: 'El nombre es obligatorio' }, { status: 422 });
    }
    const email = body.email ? String(body.email).trim() : null;
    const phone = body.phone ? String(body.phone).trim() : null;
    const company = body.company ? String(body.company).trim() : null;
    const notes = body.notes ?? null;
    const tags = Array.isArray(body.tags) ? body.tags : [];

    // Manual upsert by lower(email) to play nice with the partial unique index
    if (email) {
      const existing = await querySingle<any>(
        `SELECT id FROM clients WHERE lower(email) = lower($1)`,
        [email]
      );
      if (existing) {
        const updated = await querySingle<any>(
          `UPDATE clients SET name=$1, phone=$2, company=$3, notes=$4, tags=$5 WHERE id=$6 RETURNING *`,
          [name, phone, company, notes, JSON.stringify(tags), existing.id]
        );
        return NextResponse.json({ success: true, data: updated });
      }
    }

    const created = await querySingle<any>(
      `INSERT INTO clients (name, email, phone, company, notes, tags)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, email, phone, company, notes, JSON.stringify(tags)]
    );
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
