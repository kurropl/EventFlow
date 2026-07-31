import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { fixCatalogStructure } from '@/lib/domain/fixCatalogStructure';
import { sanitizeError } from '@/lib/security';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_session')?.value || request.cookies.get('eventflow_token')?.value;
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const result = await fixCatalogStructure();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}