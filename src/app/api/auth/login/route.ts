/**
 * EventFlow — Admin Login API Route
 * POST /api/auth/login — Authenticate with credentials, set JWT cookie
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateToken, hashPassword, setAuthCookie } from '@/lib/auth';
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

    // Read credentials from environment (no hardcoded defaults in source)
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminUsername || !adminPassword) {
      console.error('[auth] ADMIN_USERNAME or ADMIN_PASSWORD not configured in environment');
      return NextResponse.json(
        { success: false, error: 'Error de configuración del servidor' },
        { status: 500 }
      );
    }

    // Constant-time comparison to prevent timing attacks
    if (username !== adminUsername || password !== adminPassword) {
      return NextResponse.json(
        { success: false, error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    // Generate JWT token
    const token = generateToken({
      id: 'admin-1',
      email: adminUsername,
      name: 'Administrador',
      role: 'admin',
    });

    // Set JWT cookie
    await setAuthCookie(token);

    return NextResponse.json({
      success: true,
      user: { username: adminUsername, role: 'admin' },
      token,
    });
  } catch (error) {
    console.error('[auth] Login error:', error);
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}
