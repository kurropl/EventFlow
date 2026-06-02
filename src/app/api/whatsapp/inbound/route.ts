/**
 * EventFlow — WhatsApp webhook for lead intake
 * POST /api/whatsapp/inbound
 *
 * Receives WhatsApp messages (via Twilio or similar) and creates leads automatically.
 * Source: 'whatsapp'
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Support Twilio format and generic format
    const from = body.From || body.from || body.phone || body.sender || '';
    const message = body.Body || body.body || body.message || '';
    const name = body.name || null;
    const email = body.email || null;
    const eventType = body.event_type || null;
    const guestCount = body.guest_count ? parseInt(body.guest_count, 10) : null;
    const eventDate = body.event_date || null;

    if (!from && !message) {
      return NextResponse.json({ error: 'Missing sender or message' }, { status: 400 });
    }

    // Extract name from message if not provided (simple heuristic)
    const extractedName = name || extractNameFromMessage(message);

    // Create lead
    const lead = await querySingle<any>(
      `INSERT INTO leads (name, email, phone, source, event_type, guest_count, event_date, notes)
       VALUES ($1, $2, $3, 'whatsapp', $4, $5, $6, $7)
       RETURNING *`,
      [extractedName, email, cleanPhone(from), eventType, guestCount, eventDate, message]
    );

    return NextResponse.json({ success: true, data: lead }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function cleanPhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

function extractNameFromMessage(message: string): string {
  // Try to extract name from common patterns
  const patterns = [
    /(?:me llamo|soy|soy yo|me llamo|llámame)\s+([A-ZÁÉÍÓÚÑáéíóúñ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑáéíóúñ][a-záéíóúñ]+)*)/i,
    /(?:hola|buenas|hey)\s+(?:soy|me llamo|es que)\s+([A-ZÁÉÍÓÚÑáéíóúñ][a-záéíóúñ]+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  // Fallback: use first few words
  const words = message.split(/\s+/).slice(0, 3).join(' ');
  return words || 'Desconocido';
}
