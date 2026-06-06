/**
 * EventFlow — Auth Middleware (Edge Runtime compatible)
 *
 * Protects /admin/* routes and ALL /api/* routes (except public ones).
 * Uses JWT verification via Web Crypto API (no Node.js dependencies).
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ============================================================
// JWT verification (Edge Runtime compatible — uses Web Crypto)
// ============================================================

async function verifyJWT(token: string, secret: string): Promise<boolean> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const [headerB64, payloadB64, signatureB64] = parts;

    // Decode the key
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Reconstruct the signed data
    const data = encoder.encode(`${headerB64}.${payloadB64}`);

    // Decode the signature
    const sigStr = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
    const sigPadded = sigStr + '='.repeat((4 - (sigStr.length % 4)) % 4);
    const sigBytes = Uint8Array.from(atob(sigPadded), c => c.charCodeAt(0));

    // Verify
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, data);
    if (!valid) return false;

    // Check expiration
    const payload = JSON.parse(atob(payloadB64));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// ============================================================
// Route classification
// ============================================================

/** Public API routes that don't require authentication */
function isPublicRoute(pathname: string): boolean {
  // POST /api/events — configurator submission (public)
  // GET /api/guest-forms — guest form access (public)
  // POST /api/guest-forms — guest form submission (public)
  // POST /api/ai-quote — AI chatbot quote (public)
  // POST /api/webhooks/* — webhook endpoints (public, verified separately)
  if (pathname.startsWith('/api/webhooks/')) return true;
  if (pathname === '/api/ai-quote') return true;
  if (pathname === '/api/guest-forms') return true;
  if (pathname === '/api/events' && !pathname.includes('/api/events/')) {
    // Only POST is public; GET requires auth
    // We check method below
    return false; // handled by method check
  }
  return false;
}

function isPublicMethod(method: string, pathname: string): boolean {
  if (pathname === '/api/events' && method === 'POST') return true;
  if (pathname === '/api/catalog' && method === 'GET') return true;
  if (pathname === '/api/guest-forms' && (method === 'GET' || method === 'POST')) return true;
  if (pathname === '/api/ai-quote' && method === 'POST') return true;
  if (pathname.startsWith('/api/webhooks/') && method === 'POST') return true;
  return false;
}

// ============================================================
// Public admin routes (no auth needed to access)
// ============================================================
const PUBLIC_ADMIN_ROUTES = ['/admin/login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const JWT_SECRET = process.env.JWT_SECRET || '';

  // ── Admin routes ──────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    // Public admin routes (login page)
    if (PUBLIC_ADMIN_ROUTES.some((route) => pathname.startsWith(route))) {
      // If already authenticated, redirect to admin home
      const token = request.cookies.get('eventflow_token')?.value;
      if (token && JWT_SECRET && await verifyJWT(token, JWT_SECRET)) {
        return NextResponse.redirect(new URL('/admin/kanban', request.url));
      }
      return NextResponse.next();
    }

    // Protected admin routes — verify JWT cookie
    const token = request.cookies.get('eventflow_token')?.value;
    if (!token || !JWT_SECRET || !(await verifyJWT(token, JWT_SECRET))) {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }

  // ── API routes ────────────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    // Auth endpoints are always public
    if (pathname.startsWith('/api/auth/')) {
      return NextResponse.next();
    }

    // Public API routes (by method + path)
    if (isPublicMethod(request.method, pathname)) {
      return NextResponse.next();
    }

    // All other API routes require authentication
    const token = request.cookies.get('eventflow_token')?.value;
    if (!token || !JWT_SECRET || !(await verifyJWT(token, JWT_SECRET))) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*'],
};
