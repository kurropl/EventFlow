/**
 * EventFlow — Logout API Route
 * POST /api/auth/logout — Clear auth cookie
 */

import { NextResponse } from 'next/server';
import { removeAuthCookie } from '@/lib/auth';
import { sanitizeError } from '@/lib/security';

export async function POST() {
  try {
    await removeAuthCookie();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}
