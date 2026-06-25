/**
 * EventFlow — Admin Login API Route
 * POST /api/auth/login — Authenticate with credentials, set JWT cookie
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateToken, setAuthCookie, authenticateAdmin } from '@/lib/auth';
import { sanitizeError } from '@/lib/security';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Usuario y contraseña son obligatorios' },
        { status: 400 }
      );
    }

    // 1) Admin "maestro" por entorno (rol admin).
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (adminUsername && adminPassword && username === adminUsername && password === adminPassword) {
      const token = generateToken({ id: 'admin-1', email: adminUsername, name: 'Administrador', role: 'admin' });
      await setAuthCookie(token);
      return NextResponse.json({
        success: true,
        user: { username: adminUsername, role: 'admin' },
        token,
      });
    }

    // 2) Usuarios de la tabla `admins` (RBAC por perfil: cocina/camareros/clientes/admin).
    //    `username` se interpreta como email.
    const auth = await authenticateAdmin(username, password);
    if (auth.success && auth.user) {
      const token = generateToken(auth.user);
      await setAuthCookie(token);
      return NextResponse.json({
        success: true,
        user: { username: auth.user.email, name: auth.user.name, role: auth.user.role },
        token,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Credenciales inválidas' },
      { status: 401 }
    );
  } catch (error) {
    console.error('[auth] Login error:', error);
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}
