/**
 * EventFlow — Briefing API
 *
 * GET  /api/briefing/[eventId]           — Obtener briefing (genera si no existe)
 * POST /api/briefing/[eventId]           — Regenerar briefing
 * POST /api/briefing/[eventId]/send       — Marcar como enviado (sent_at)
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

export const dynamic = 'force-dynamic';

function generateReply(req: NextRequest) {
  return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const { eventId } = params;
    if (!eventId) return NextResponse.json({ success: false, error: 'eventId required' }, { status: 400 });

    // Try existing briefing first
    let brief = await query(
      `SELECT * FROM event_briefings WHERE event_id = $1 ORDER BY version DESC LIMIT 1`,
      [eventId]
    );

    if (brief.rows?.[0]) {
      return NextResponse.json({ success: true, data: brief.rows[0] });
    }

    // Generate new briefing
    const result = await generateBriefing(eventId);
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const { eventId } = params;
    if (!eventId) return NextResponse.json({ success: false, error: 'eventId required' }, { status: 400 });

    const url = _req.nextUrl.pathname;
    const isSend = url.endsWith('/send');

    if (isSend) {
      await query(
        `UPDATE event_briefings SET status = 'sent', sent_at = now() WHERE event_id = $1 AND status = 'draft'`,
        [eventId]
      );
      return NextResponse.json({ success: true, data: { status: 'sent' } });
    }

    // Regenerate: delete old drafts and generate new
    await query(`DELETE FROM event_briefings WHERE event_id = $1 AND status = 'draft'`, [eventId]);
    const result = await generateBriefing(eventId);
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}

async function generateBriefing(eventId: string) {
  // 1. Event data
  const eventRes = await query(
    `SELECT e.*, q.total_pvp as budget_total, q.margin_pct,
            q.iva_pct, q.items as quote_items
     FROM events e LEFT JOIN quotes q ON q.id = e.quote_id
     WHERE e.id = $1`,
    [eventId]
  );
  if (!eventRes.rows?.[0]) return { success: false, error: 'Evento no encontrado' };
  const ev = eventRes.rows[0] as any;

  // 2. Menu items
  const menuRes = await query(
    `SELECT emi.*, ci.allergens, ci.description
     FROM event_menu_items emi
     LEFT JOIN catalog_items ci ON ci.name = emi.name
     WHERE emi.event_id = $1
     ORDER BY emi.category, emi.name`,
    [eventId]
  );

  // 3. Staffing assignments (waiters/workers)
  const staffRes = await query(
    `SELECT sa.id, w.name as worker_name, w.roles,
            sl.role as line_role, sl.location, sl.notes as line_notes,
            sa.position
     FROM staffing_assignments sa
     JOIN staffing_lines sl ON sl.id = sa.staffing_line_id
     JOIN workers w ON w.id = sa.worker_id
     WHERE sl.event_id = $1
     ORDER BY sl.role, w.name`,
    [eventId]
  );

  // 4. Timeline (event_plans)
  const plansRes = await query(
    `SELECT * FROM event_plans WHERE event_id = $1
     ORDER BY sort_order ASC, planned_time ASC`,
    [eventId]
  );

  // 5. Floorplan summary
  const floorplanRes = await query(
    `SELECT * FROM event_floorplans WHERE event_id = $1 LIMIT 1`,
    [eventId]
  );

  // 6. Table assignments count
  const tablesRes = await query(
    `SELECT COUNT(*)::int as total_tables,
            COUNT(*) FILTER (WHERE capacity > 0)::int as seating_tables,
            SUM(capacity)::int as total_capacity
     FROM tables WHERE event_id = $1`,
    [eventId]
  );

  const guestConfirmRes = await query(
    `SELECT COUNT(*)::int as confirmed,
            COUNT(*) FILTER (WHERE rsvp = 'confirmado')::int as confirmed_count,
            COUNT(*) FILTER (WHERE rsvp = 'pendiente')::int as pending_count
     FROM guests WHERE event_id = $1`,
    [eventId]
  );

  // Build briefing content
  const content = {
    event: {
      client_name: ev.client_name,
      event_date: ev.event_date,
      event_type: ev.event_type,
      guest_count: ev.guest_count,
      kids_count: ev.kids_count,
      bar_hours: ev.bar_hours,
      client_phone: ev.client_phone,
      client_email: ev.client_email,
      notes: ev.notes,
      linen_type: ev.linen_type,
      centerpiece: ev.centerpiece,
      custom_pass_order: ev.custom_pass_order,
    },
    menu: (menuRes.rows || []).map((r: any) => ({
      name: r.name,
      category: r.category,
      quantity: r.quantity,
      unit_price_pvp: r.unit_price_pvp,
      subtotal_pvp: r.subtotal_pvp,
      allergens: r.allergens || [],
      description: r.description || '',
    })),
    staffing: (staffRes.rows || []).map((r: any) => ({
      worker_name: r.worker_name,
      role: r.line_role,
      location: r.location,
      position: r.position,
      notes: r.line_notes,
    })),
    timeline: (plansRes.rows || []).map((r: any) => ({
      title: r.title,
      description: r.description,
      planned_time: r.planned_time,
      category: r.category,
      completed: r.completed,
    })),
    floorplan: floorplanRes.rows?.[0] || null,
    tables: {
      total: Number((tablesRes.rows[0] as any)?.total_tables || 0),
      total_capacity: Number((tablesRes.rows[0] as any)?.total_capacity || 0),
    },
    guests: {
      confirmed: Number((guestConfirmRes.rows[0] as any)?.confirmed_count || 0),
      pending: Number((guestConfirmRes.rows[0] as any)?.pending_count || 0),
    },
  };

  // Insert briefing
  const result = await query(
    `INSERT INTO event_briefings (event_id, generated_by, content, version)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [eventId, 'system', JSON.stringify(content), 1]
  );

  return {
    success: true,
    data: result.rows?.[0] || { event_id: eventId, content },
  };
}