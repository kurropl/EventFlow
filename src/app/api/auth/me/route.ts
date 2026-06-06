/**
 * EventFlow — Auth Check API Route
 * GET /api/auth/me — Return current user if authenticated
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { sanitizeError } from '@/lib/security';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, authenticated: false }, { status: 401 });
    }
    return NextResponse.json({ success: true, authenticated: true, user });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}
