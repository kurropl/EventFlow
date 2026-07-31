/**
 * EventFlow — Packs API (Pack Templates + Event Packs)
 * 
 * GET  /api/cocina/packs          — List pack templates
 * POST /api/cocina/packs          — Create pack template
 * GET  /api/cocina/packs/event    — Get packs for event
 * POST /api/cocina/packs/event    — Assign pack to event
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sanitizeError } from '@/lib/security';

async function verifyAuth(request: NextRequest) {
  const token = request.cookies.get('admin_session')?.value || request.cookies.get('eventflow_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    const searchParams = new URL(request.url).searchParams;
    const eventId = searchParams.get('event_id');

    if (eventId) {
      // Get packs for specific event
      const packs = await queryMany<any>(
        `SELECT ep.*, pt.nombre as pack_nombre, pt.items as pack_items
         FROM event_packs ep
         JOIN pack_templates pt ON pt.id = ep.pack_id
         WHERE ep.event_id = $1
         ORDER BY pt.nombre`,
        [eventId]
      );
      return NextResponse.json({ success: true, data: packs });
    }

    // Get all pack templates
    const templates = await queryMany<any>(
      "SELECT * FROM pack_templates WHERE active = true ORDER BY nombre",
      []
    );
    return NextResponse.json({ success: true, data: templates });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    const body = await request.json();
    
    // Check if it's assigning to event or creating template
    if (body.event_id && body.pack_id) {
      // Assign pack to event
      const existing = await querySingle<any>(
        "SELECT id FROM event_packs WHERE event_id = $1 AND pack_id = $2",
        [body.event_id, body.pack_id]
      );

      if (existing) {
        return NextResponse.json({ success: false, error: 'Pack ya asignado a este evento' }, { status: 400 });
      }

      const pack = await querySingle<any>(
        `INSERT INTO event_packs (event_id, pack_id, items_personalizados, completado, created_at)
         VALUES ($1, $2, $3, false, NOW())
         RETURNING *`,
        [body.event_id, body.pack_id, body.items_personalizados || null]
      );
      return NextResponse.json({ success: true, data: pack }, { status: 201 });
    }

    // Create new pack template
    if (!body.nombre || !body.items) {
      return NextResponse.json({ success: false, error: 'nombre y items requeridos' }, { status: 400 });
    }

    const template = await querySingle<any>(
      `INSERT INTO pack_templates (nombre, items, active, created_at)
       VALUES ($1, $2, true, NOW())
       RETURNING *`,
      [body.nombre, JSON.stringify(body.items)]
    );

    return NextResponse.json({ success: true, data: template }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    const body = await request.json();
    if (!body.id) return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 });

    const pack = await querySingle<any>(
      `UPDATE event_packs SET
        completado = COALESCE($1, completado),
        items_personalizados = COALESCE($2, items_personalizados)
       WHERE id = $3
       RETURNING *`,
      [body.completado, body.items_personalizados ? JSON.stringify(body.items_personalizados) : null, body.id]
    );

    if (!pack) return NextResponse.json({ success: false, error: 'No encontrado' }, { status: 404 });

    return NextResponse.json({ success: true, data: pack });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}