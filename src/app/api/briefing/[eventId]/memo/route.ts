/**
 * EventFlow — Memo por trabajador (FR-A12)
 * GET /api/briefing/[eventId]/memo
 *
 * Delega en domain/briefingMemo.ts (fuente única del contenido del memo,
 * compartida con el cron pre-event-briefing que envía esto mismo por
 * WhatsApp/email la noche antes).
 */
import { NextRequest, NextResponse } from 'next/server';
import { sanitizeError } from '@/lib/security';
import { generateEventMemos } from '@/lib/briefingMemo';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { eventId: string } }) {
  try {
    const data = await generateEventMemos(params.eventId);
    if (!data) return NextResponse.json({ success: false, error: 'Evento no encontrado' }, { status: 404 });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
