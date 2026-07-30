/**
 * EventFlow — Leads API
 * GET    /api/leads       — List all leads (with optional search/filter)
 * POST   /api/leads       — Create a new lead manually
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { sanitizeError, isValidUUID } from '@/lib/security';
import { getCurrentUser } from '@/lib/auth';
import { z } from 'zod';

// ── Types ───────────────────────────────────────────────────────

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  status: string;
  notes: string | null;
  event_type: string | null;
  guest_count: number | null;
  event_date: string | null;
  menu_id: string | null;  // WP-14: UUID del menú seleccionado
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

// ── Validation ──────────────────────────────────────────────────

const CreateLeadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format').optional().or(z.literal('')).nullable(),
  phone: z.string().optional().nullable(),
  source: z.string().optional(),
  event_type: z.string().optional().nullable(),
  guest_count: z.number().int().positive('Guest count must be > 0').optional().nullable(),
  event_date: z.string().optional().nullable(),
  menu_id: z.string().uuid('Invalid menu ID').optional().or(z.literal('')).nullable(),  // WP-14
});

// ── Handlers ────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const assignedTo = searchParams.get('assigned_to');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);

    // G13 (Sprint 4): assigned_to vive solo en leads (fuente única, E-B4).
    let sql = `SELECT l.*, a.name AS assigned_to_name,
      COALESCE((
        SELECT jsonb_agg(DISTINCT jsonb_build_object('id',q.id,'status',q.status,'total_pvp',q.total_pvp,'event_date',e.event_date,'event_type',e.event_type))
        FROM quotes q
        JOIN events e ON e.id = q.event_id
        WHERE q.lead_id = l.id
           OR (l.email IS NOT NULL AND e.client_email = l.email)
      ), '[]'::jsonb) AS quotes
      FROM leads l
      LEFT JOIN admins a ON a.id = l.assigned_to`;
    const params: (string | number)[] = [];
    const conds: string[] = [];

    if (status) {
      conds.push(`l.status = $${params.length + 1}`);
      params.push(status);
    }
    if (search) {
      conds.push(`(l.name ILIKE $${params.length + 1} OR l.email ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }
    if (assignedTo) {
      conds.push(`l.assigned_to = $${params.length + 1}`);
      params.push(assignedTo);
    }

    if (conds.length > 0) sql += ` WHERE ${conds.join(' AND ')}`;
    sql += ` ORDER BY l.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const rows = await queryMany<Lead>(sql, params);
    return NextResponse.json({ data: rows });
  } catch (error) {
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateLeadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Validation error' },
        { status: 400 }
      );
    }

    const { name, email, phone, source, event_type, guest_count, event_date, menu_id } = parsed.data;

    // G13 (Sprint 4): auto-asigna el lead al usuario autenticado que lo crea
    // (null si viene de un flujo público/no autenticado, p.ej. configurador,
    // o del admin "maestro" por variables de entorno, cuyo id sintético
    // 'admin-1' no es una fila real de `admins` y no puede usarse como FK).
    const currentUser = await getCurrentUser();
    const assignedTo = currentUser?.id && isValidUUID(currentUser.id) ? currentUser.id : null;

    const lead = await querySingle<Lead>(
      `INSERT INTO leads (name, email, phone, source, event_type, guest_count, event_date, menu_id, assigned_to)
       VALUES ($1, $2, $3, COALESCE($4, 'manual'), $5, $6, $7, $8, $9)
       RETURNING *`,
      [name, email || null, phone || null, source || 'manual', event_type || null, guest_count || null, event_date || null, menu_id || null, assignedTo]
    );

    // Send welcome email to new lead
    if (lead && lead.email) {
      try {
        const { sendEmail, templates } = await import('@/lib/email');
        const tpl = await templates.newLead(lead.name, lead.email);
        await sendEmail({ to: lead.email, subject: tpl.subject, html: tpl.html });
      } catch (e) {
        console.warn('[EMAIL] Failed to send new lead email:', e);
      }
    }

    return NextResponse.json({ data: lead }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}
