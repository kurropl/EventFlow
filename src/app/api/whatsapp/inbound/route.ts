/**
 * EventFlow — WhatsApp webhook for lead intake
 * POST /api/whatsapp/inbound
 *
 * Receives WhatsApp messages (via Twilio or similar) and creates leads.
 * Security: Twilio signature verification, input sanitization, length limits.
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle } from '@/lib/db';
import { sanitizeText, checkRateLimit, getClientIp } from '@/lib/security';
import crypto from 'crypto';

// Twilio signature verification
// See: https://www.twilio.com/docs/usage/security#validating-signatures
function verifyTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  // Build the data string: URL + sorted params
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + params[key];
  }
  // HMAC-SHA1
  const hmac = crypto.createHmac('sha1', authToken).update(data).digest('base64');
  return hmac === signature;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 30 req/min per IP
    const ip = getClientIp(request);
    const rl = checkRateLimit(`whatsapp:${ip}`, 30, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const rawBody = await request.text();
    const body = JSON.parse(rawBody);

    // Twilio signature verification (skip if TWILIO_AUTH_TOKEN not configured)
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioSignature = request.headers.get('x-twilio-signature');
    if (twilioAuthToken && twilioSignature) {
      const url = request.url;
      // Parse body as flat key-value for signature verification
      const params: Record<string, string> = {};
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === 'string') params[key] = value;
      }
      if (!verifyTwilioSignature(twilioAuthToken, twilioSignature, url, params)) {
        console.warn('[whatsapp] Invalid Twilio signature from', ip);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
      }
    }

    // Support Twilio format and generic format
    const from = body.From || body.from || body.phone || body.sender || '';
    const message = body.Body || body.body || body.message || '';
    const name = body.name ? sanitizeText(String(body.name)).slice(0, 200) : null;
    const email = body.email ? sanitizeText(String(body.email)).slice(0, 254) : null;
    const eventType = body.event_type ? sanitizeText(String(body.event_type)).slice(0, 100) : null;
    const guestCount = body.guest_count ? parseInt(String(body.guest_count), 10) : null;
    const eventDate = body.event_date || null;

    // Sanitize message (truncate to 2000 chars to prevent DoS)
    const safeMessage = sanitizeText(String(message)).slice(0, 2000);

    if (!from && !safeMessage) {
      return NextResponse.json({ error: 'Missing sender or message' }, { status: 400 });
    }

    // Extract name from message if not provided
    const extractedName = name || extractNameFromMessage(safeMessage);

    // Create lead
    const lead = await querySingle<any>(
      `INSERT INTO leads (name, email, phone, source, event_type, guest_count, event_date, notes)
       VALUES ($1, $2, $3, 'whatsapp', $4, $5, $6, $7)
       RETURNING *`,
      [extractedName, email, cleanPhone(String(from)), eventType, guestCount, eventDate, safeMessage]
    );

    return NextResponse.json({ success: true, data: lead }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'WhatsApp webhook error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function cleanPhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '').slice(0, 20);
}

function extractNameFromMessage(message: string): string {
  const patterns = [
    /(?:me llamo|soy|soy yo|llámame)\s+([A-ZÁÉÍÓÚÑáéíóúñ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑáéíóúñ][a-záéíóúñ]+)*)/i,
    /(?:hola|buenas|hey)\s+(?:soy|me llamo|es que)\s+([A-ZÁÉÍÓÚÑáéíóúñ][a-záéíóúñ]+)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) return match[1].trim().slice(0, 100);
  }

  const words = message.split(/\s+/).slice(0, 3).join(' ');
  return words.slice(0, 100) || 'Desconocido';
}
