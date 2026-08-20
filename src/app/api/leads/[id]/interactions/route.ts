/**
 * EventFlow — Lead Interactions API
 * 
 * GET  /api/leads/[id]/interactions — Listar interacciones del lead
 * POST /api/leads/[id]/interactions — Crear interacción
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { verifyToken, verifyAuth } from '@/lib/auth';
import { sanitizeError } from '@/lib/security';


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    const { id } = await params;

    const interactions = await queryMany<any>(
      `SELECT i.*, a.name as created_by_name
       FROM lead_interactions i
       LEFT JOIN admins a ON a.id = i.created_by
       WHERE i.lead_id = $1
       ORDER BY i.created_at DESC`,
      [id]
    );

    return NextResponse.json({ success: true, data: interactions });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();

    if (!body.interaction_type) {
      return NextResponse.json({ success: false, error: 'Tipo de interacción requerido' }, { status: 400 });
    }

    const interaction = await querySingle<any>(
      `INSERT INTO lead_interactions (lead_id, interaction_type, subject, description, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [id, body.interaction_type, body.subject || null, body.description || null, auth.id || null]
    );

    // Update last_contact_at on lead
    await querySingle<any>(
      "UPDATE leads SET last_contact_at = NOW(), updated_at = NOW() WHERE id = $1",
      [id]
    );

    return NextResponse.json({ success: true, data: interaction }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}