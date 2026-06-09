/**
 * EventFlow — Uniform Catalog API
 * GET /api/staffing/uniforms — List uniforms
 * POST /api/staffing/uniforms — Create uniform
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { sanitizeError, sanitizeText } from '@/lib/security';
import { verifyToken } from '@/lib/auth';

function requireAuth(request: NextRequest): { authenticated: boolean; error?: string } {
  const token = request.cookies.get('admin_session')?.value || request.cookies.get('eventflow_token')?.value;
  if (!token) return { authenticated: false, error: 'No autenticado' };
  const user = verifyToken(token);
  if (!user) return { authenticated: false, error: 'Token inválido' };
  return { authenticated: true };
}

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if (!auth.authenticated) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

    const rows = await queryMany<any>(
      `SELECT id, name, description, color, gender, active FROM uniform_catalog WHERE active = true ORDER BY name`
    );
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if (!auth.authenticated) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

    const body = await request.json();
    const name = body.name ? sanitizeText(body.name, 100) : '';
    const description = body.description ? sanitizeText(body.description, 300) : null;
    const color = body.color ? sanitizeText(body.color, 50) : null;
    const gender = body.gender || 'unisex';

    if (!name) return NextResponse.json({ success: false, error: 'El nombre es obligatorio' }, { status: 422 });

    const created = await querySingle<any>(
      `INSERT INTO uniform_catalog (name, description, color, gender)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, description, color, gender]
    );
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
