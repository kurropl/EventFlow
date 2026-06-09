/**
 * EventFlow — WhatsApp Webhook Handler
 * 
 * Receives WhatsApp Cloud API webhook notifications.
 * Processes staffing offer responses (ACEPTAR/RECHAZAR).
 * 
 * Verification: https://developers.facebook.com/docs/graph-api/webhooks/getting-started
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany, transaction } from '@/lib/db';
import { getWhatsAppClient, buildStaffingConfirmationMessage, buildStaffingFullMessage } from '@/lib/whatsapp';
import crypto from 'crypto';

// ============================================================
// GET: Webhook verification (Meta challenges)
// ============================================================

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === (process.env.WHATSAPP_VERIFY_TOKEN || 'eventflow-verify')) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// ============================================================
// POST: Receive incoming messages
// ============================================================

export async function POST(request: NextRequest) {
  try {
    // 1. Verify signature (if provided)
    const signature = request.headers.get('x-hub-signature-256');
    const body = await request.text();

    if (signature && process.env.WHATSAPP_APP_SECRET) {
      const expected = 'sha256=' + crypto
        .createHmac('sha256', process.env.WHATSAPP_APP_SECRET)
        .update(body)
        .digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        console.warn('[whatsapp-webhook] Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    // 2. Parse webhook payload
    const payload = JSON.parse(body);
    const entries = payload.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== 'messages') continue;
        const value = change.value;

        // Process incoming messages
        const messages = value.messages || [];
        for (const msg of messages) {
          if (msg.type !== 'text') continue;
          await processMessage(msg, value.contacts?.[0]);
        }
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('[whatsapp-webhook] Error:', error);
    return NextResponse.json({ status: 'ok' }); // Always return 200 to prevent retries
  }
}

// ============================================================
// Process a single incoming message
// ============================================================

async function processMessage(msg: any, contact?: any) {
  const phone = msg.from;       // E.164 phone
  const text = (msg.text?.body || '').trim().toUpperCase();

  // Determine response: ACEPTAR or RECHAZAR
  let response: 'accepted' | 'rejected' | null = null;
  if (text.includes('ACEPTAR') || text.includes('ACEPTO') || text === 'SI' || text === 'SÍ') {
    response = 'accepted';
  } else if (text.includes('RECHAZAR') || text.includes('RECHAZO') || text.includes('NO')) {
    response = 'rejected';
  }

  if (!response) {
    console.log(`[whatsapp-webhook] Ignoring non-actionable message from ${phone}: "${msg.text?.body}"`);
    return;
  }

  console.log(`[whatsapp-webhook] ${phone} responded: ${response}`);

  // Find pending offer for this phone number
  const worker = await querySingle<{ id: string }>(
    `SELECT id FROM workers WHERE phone = $1`,
    [phone]
  );

  if (!worker) {
    console.log(`[whatsapp-webhook] No worker found for phone ${phone}`);
    return;
  }

  // Find the most recent 'sent' offer for this worker
  const offer = await querySingle<any>(
    `SELECT so.id, so.staffing_line_id, sl.role, sl.slots_needed, sl.event_id,
            sl.start_time, sl.end_time, sl.location, sl.uniform, sl.status as line_status,
            e.client_name, e.event_date
     FROM staffing_offers so
     JOIN staffing_lines sl ON sl.id = so.staffing_line_id
     JOIN events e ON e.id = sl.event_id
     WHERE so.worker_id = $1 AND so.status = 'sent' AND sl.status = 'open'
     ORDER BY so.sent_at DESC
     LIMIT 1`,
    [worker.id]
  );

  if (!offer) {
    console.log(`[whatsapp-webhook] No pending offer found for worker ${worker.id}`);
    return;
  }

  // Update offer status
  await querySingle(
    `UPDATE staffing_offers SET status = $1, responded_at = now() WHERE id = $2`,
    [response, offer.id]
  );

  // If rejected, done
  if (response === 'rejected') {
    console.log(`[whatsapp-webhook] Worker ${worker.id} rejected offer ${offer.id}`);
    return;
  }

  // If accepted — atomic assignment via transaction
  try {
    const result = await transaction(async (client) => {
      // Lock the staffing line row to prevent race conditions
      const lineRow = await client.query(
        `SELECT id, slots_needed, status FROM staffing_lines WHERE id = $1 FOR UPDATE`,
        [offer.staffing_line_id]
      );

      if (!lineRow.rows[0] || lineRow.rows[0].status !== 'open') {
        return { success: false, reason: 'line_not_open' };
      }

      const slotsNeeded = lineRow.rows[0].slots_needed;

      // Check if worker is already assigned to this line
      const existingAssignment = await client.query(
        `SELECT id FROM staffing_assignments WHERE staffing_line_id = $1 AND worker_id = $2`,
        [offer.staffing_line_id, worker.id]
      );

      if (existingAssignment.rows.length > 0) {
        return { success: false, reason: 'already_assigned' };
      }

      // Count current assignments
      const countRes = await client.query(
        `SELECT COUNT(*)::int as cnt FROM staffing_assignments WHERE staffing_line_id = $1`,
        [offer.staffing_line_id]
      );
      const currentCount = countRes.rows[0].cnt;

      if (currentCount >= slotsNeeded) {
        return { success: false, reason: 'line_full' };
      }

      // Create assignment with position = current count + 1
      const assignment = await client.query(
        `INSERT INTO staffing_assignments (staffing_line_id, worker_id, offer_id, position)
         VALUES ($1, $2, $3, $4)
         RETURNING id, position, confirmed_at`,
        [offer.staffing_line_id, worker.id, offer.id, currentCount + 1]
      );

      const newPosition = assignment.rows[0].position;

      // If line is now full, update status and expire remaining offers
      if (currentCount + 1 >= slotsNeeded) {
        await client.query(
          `UPDATE staffing_lines SET status = 'filled', updated_at = now() WHERE id = $1`,
          [offer.staffing_line_id]
        );

        // Expire remaining 'sent' offers
        await client.query(
          `UPDATE staffing_offers SET status = 'expired', responded_at = now()
           WHERE staffing_line_id = $1 AND status = 'sent'`,
          [offer.staffing_line_id]
        );
      }

      return { success: true, position: newPosition, lineFull: currentCount + 1 >= slotsNeeded };
    });

    if (result.success) {
      // Send confirmation WhatsApp
      const workerData = await querySingle<{ name: string }>(
        `SELECT name FROM workers WHERE id = $1`, [worker.id]
      );

      const client = getWhatsAppClient();
      const formatDate = (d: string) => {
        const date = new Date(d);
        return date.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      };
      const formatTime = (d: string) => {
        const date = new Date(d);
        return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      };

      await client.sendMessage(phone, buildStaffingConfirmationMessage({
        workerName: workerData?.name || 'Trabajador',
        roleName: offer.role,
        eventDate: formatDate(offer.event_date),
        startTime: formatTime(offer.start_time),
        endTime: formatTime(offer.end_time),
        location: offer.location || 'Por definir',
        uniform: offer.uniform || 'Uniforme estándar',
        position: result.position,
      }));

      console.log(`[whatsapp-webhook] Worker ${worker.id} assigned to line ${offer.staffing_line_id} at position #${result.position}`);

      // If line is now full, notify expired workers
      if (result.lineFull) {
        const expiredOffers = await queryMany<{ worker_id: string }>(
          `SELECT worker_id FROM staffing_offers 
           WHERE staffing_line_id = $1 AND status = 'expired' AND worker_id != $2`,
          [offer.staffing_line_id, worker.id]
        );

        for (const expired of expiredOffers) {
          const expiredWorker = await querySingle<{ phone: string; name: string }>(
            `SELECT phone, name FROM workers WHERE id = $1`, [expired.worker_id]
          );
          if (expiredWorker?.phone) {
            await client.sendMessage(expiredWorker.phone, buildStaffingFullMessage({
              workerName: expiredWorker.name,
              roleName: offer.role,
              eventDate: formatDate(offer.event_date),
            }));
          }
        }
      }
    } else {
      console.log(`[whatsapp-webhook] Assignment failed: ${result.reason}`);
    }
  } catch (error) {
    console.error('[whatsapp-webhook] Transaction error:', error);
  }
}
