/**
 * EventFlow — Authentication Module
 *
 * JWT-based auth for admin panel using local PostgreSQL.
 * Tokens are stored in httpOnly cookies for security.
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { querySingle } from '@/lib/db';

// ============================================================
// Config
// ============================================================

import { getJWTSecret, getAdminCredentials } from '@/lib/config';

const JWT_SECRET = getJWTSecret();
const COOKIE_NAME = 'eventflow_token';
const TOKEN_EXPIRY = '24h';

// ============================================================
// Types
// ============================================================

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface AuthResult {
  success: boolean;
  user?: AdminUser;
  error?: string;
}

// ============================================================
// Password helpers
// ============================================================

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ============================================================
// JWT helpers
// ============================================================

export function generateToken(user: AdminUser): string {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY, algorithm: 'HS256' }
  );
}

export function verifyToken(token: string): AdminUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as AdminUser;
    return decoded;
  } catch {
    return null;
  }
}

// ============================================================
// Cookie helpers
// ============================================================

export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });
}

export async function removeAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getAuthCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value;
}

// ============================================================
// Auth helpers
// ============================================================

interface AdminRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: string;
}

export async function authenticateAdmin(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    const admin = await querySingle<AdminRow>(
      `SELECT id, email, name, password_hash, role FROM admins WHERE email = $1 AND active = true`,
      [email]
    );

    if (!admin) {
      return { success: false, error: 'Credenciales inválidas' };
    }

    const valid = await verifyPassword(password, admin.password_hash);
    if (!valid) {
      return { success: false, error: 'Credenciales inválidas' };
    }

    // Update last login
    await querySingle(
      `UPDATE admins SET last_login = now() WHERE id = $1`,
      [admin.id]
    );

    const user: AdminUser = {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    };

    return { success: true, user };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[auth] Login error:', msg);
    return { success: false, error: 'Error interno del servidor' };
  }
}

// ============================================================
// Get current user from cookie
// ============================================================

export async function getCurrentUser(): Promise<AdminUser | null> {
  try {
    const token = await getAuthCookie();
    if (!token) return null;
    return verifyToken(token);
  } catch {
    return null;
  }
}

// ============================================================
// Require auth (for API routes)
// ============================================================

export async function requireAuth(): Promise<AdminUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

// ============================================================
// API-route auth helpers (shared — replaces 30+ local copies)
// ============================================================

import type { NextRequest } from 'next/server';

/**
 * Verify auth from a NextRequest cookie. Returns the AdminUser or null.
 * Mirrors the pattern that used to be copy-pasted into every API route.
 */
export function verifyAuth(request: NextRequest): AdminUser | null {
  const token =
    request.cookies.get('admin_session')?.value ||
    request.cookies.get('eventflow_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Require auth from a NextRequest cookie. Returns { authenticated } or
 * { authenticated: false, error }. Includes userId when authenticated.
 * Mirrors the requireAuth variant used by supplier-orders and stock APIs.
 */
export function requireAuthRequest(request: NextRequest): { authenticated: boolean; error?: string; userId?: string } {
  const token =
    request.cookies.get('admin_session')?.value ||
    request.cookies.get('eventflow_token')?.value;
  if (!token) return { authenticated: false, error: 'No autenticado' };
  const user = verifyToken(token);
  if (!user) return { authenticated: false, error: 'Token inválido' };
  return { authenticated: true, userId: user.id };
}