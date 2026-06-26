/**
 * EventFlow — Gestión de usuarios de acceso (RBAC · FR-R04)
 * GET  /api/admin/users   — lista de usuarios (solo admin, vía middleware)
 * POST /api/admin/users   — crea un usuario con perfil
 *
 * El enforcement de "solo admin" lo aplica el middleware (regla /api/admin/users).
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { sanitizeError } from '@/lib/security';
import { isRole, ROLES } from '@/lib/rbac';
import { hasRole } from '@/lib/authz';

const FORBIDDEN = { success: false, error: 'Solo Administración' };

export async function GET(request: NextRequest) {
  try {
    if (!hasRole(request, 'admin')) return NextResponse.json(FORBIDDEN, { status: 403 });
    const users = await queryMany<any>(
      `SELECT id, email, name, role, active, worker_id, last_login, created_at
       FROM admins ORDER BY created_at ASC`
    );
    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasRole(request, 'admin')) return NextResponse.json(FORBIDDEN, { status: 403 });
    const { email, name, password, role, worker_id } = await request.json();
    if (!email || !name || !password || !role) {
      return NextResponse.json(
        { success: false, error: 'email, name, password y role son obligatorios' },
        { status: 400 }
      );
    }
    if (!isRole(role)) {
      return NextResponse.json(
        { success: false, error: `role inválido (válidos: ${ROLES.join(', ')})` },
        { status: 400 }
      );
    }
    const existing = await querySingle<any>(`SELECT id FROM admins WHERE lower(email) = lower($1)`, [email]);
    if (existing) {
      return NextResponse.json({ success: false, error: 'Ya existe un usuario con ese email' }, { status: 409 });
    }
    const password_hash = await hashPassword(password);
    const user = await querySingle<any>(
      `INSERT INTO admins (email, name, password_hash, role, worker_id, active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, email, name, role, active, worker_id, created_at`,
      [email, name, password_hash, role, worker_id || null]
    );
    return NextResponse.json({ success: true, data: user }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
