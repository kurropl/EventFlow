/**
 * EventFlow — Usuario de acceso individual (RBAC · FR-R04)
 * PUT    /api/admin/users/[id]  — actualizar rol / activo / nombre / contraseña
 * DELETE /api/admin/users/[id]  — desactivar (soft) el usuario
 */
import { NextRequest, NextResponse } from 'next/server';
import { querySingle } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { sanitizeError } from '@/lib/security';
import { isRole } from '@/lib/rbac';
import { hasRole } from '@/lib/authz';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasRole(request, 'admin')) return NextResponse.json({ success: false, error: 'Solo Administración' }, { status: 403 });
    const { name, role, active, password, worker_id } = await request.json();
    const sets: string[] = [];
    const vals: any[] = [];
    let p = 1;
    if (name !== undefined) { sets.push(`name = $${p++}`); vals.push(name); }
    if (role !== undefined) {
      if (!isRole(role)) return NextResponse.json({ success: false, error: 'role inválido' }, { status: 400 });
      sets.push(`role = $${p++}`); vals.push(role);
    }
    if (active !== undefined) { sets.push(`active = $${p++}`); vals.push(!!active); }
    if (worker_id !== undefined) { sets.push(`worker_id = $${p++}`); vals.push(worker_id || null); }
    if (password) { sets.push(`password_hash = $${p++}`); vals.push(await hashPassword(password)); }
    if (sets.length === 0) return NextResponse.json({ success: false, error: 'Nada que actualizar' }, { status: 400 });
    vals.push(params.id);
    const user = await querySingle<any>(
      `UPDATE admins SET ${sets.join(', ')} WHERE id = $${p}
       RETURNING id, email, name, role, active, worker_id`,
      vals
    );
    if (!user) return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 });
    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasRole(request, 'admin')) return NextResponse.json({ success: false, error: 'Solo Administración' }, { status: 403 });
    const user = await querySingle<any>(
      `UPDATE admins SET active = false WHERE id = $1 RETURNING id, email, active`, [params.id]
    );
    if (!user) return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 });
    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
