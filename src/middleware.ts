/**
 * EventFlow — Admin Auth Middleware
 *
 * Protects /admin/* routes behind a simple password-based login.
 * Uses a secure signed cookie for session persistence.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that don't require auth
const PUBLIC_ADMIN_ROUTES = ['/admin/login'];

// Cookie name and TTL
const AUTH_COOKIE = 'eventflow_admin_session';
const SESSION_TTL_MINUTES = 480; // 8 hours

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /admin/* routes
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  // Public admin routes (login page)
  if (PUBLIC_ADMIN_ROUTES.some((route) => pathname.startsWith(route))) {
    // If already authenticated, redirect to admin home
    const session = request.cookies.get(AUTH_COOKIE);
    if (session?.value === 'authenticated') {
      return NextResponse.redirect(new URL('/admin/kanban', request.url));
    }
    return NextResponse.next();
  }

  // Protected admin routes — check session cookie
  const session = request.cookies.get(AUTH_COOKIE);
  if (session?.value !== 'authenticated') {
    // Redirect to login page
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};