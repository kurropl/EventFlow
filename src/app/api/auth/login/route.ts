/**
 * EventFlow — Admin Login API Route
 * POST /api/auth/login — Authenticate with password, set session cookie
 * POST /api/auth/logout — Clear session cookie
 */

import { NextRequest, NextResponse } from 'next/server';

// Admin credentials from env or defaults
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Cookie config
const AUTH_COOKIE = 'eventflow_admin_session';
const MAX_AGE = 480 * 60; // 8 hours in seconds

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, username, password } = body;

    if (action === 'logout') {
      const response = NextResponse.json({ success: true });
      response.cookies.set(AUTH_COOKIE, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      });
      return response;
    }

    // Login action
    if (username === ADMIN_USER && password === ADMIN_PASSWORD) {
      const response = NextResponse.json({
        success: true,
        user: { username: ADMIN_USER },
      });

      // Set session cookie
      response.cookies.set(AUTH_COOKIE, 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: MAX_AGE,
      });

      return response;
    }

    // Invalid credentials
    return NextResponse.json(
      { success: false, error: 'Credenciales inválidas' },
      { status: 401 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}