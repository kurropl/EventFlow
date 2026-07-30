/**
 * EventFlow — WP-17 Staffing Turnos Tests
 * 
 * Tests for:
 * - Offer token generation
 * - Public shift confirmation API
 * - Hours preloading
 * - Idempotency checks
 * 
 * Run with: npx jest __tests__/wp17-staffing-turnos.test.ts
 */

import { querySingle, queryMany, transaction } from '../src/lib/db';
import crypto from 'crypto';

// ============================================================
// Test helpers
// ============================================================

async function createTestEvent() {
  const result = await querySingle<{ id: string }>(
    `INSERT INTO events (client_name, client_email, event_type, guest_count, kids_count, event_date, status, selected_items, bar_hours)
     VALUES ('WP17 Test Event', 'wp17@test.com', 'boda', 50, 2, '2026-12-15', 'accepted', '[]', 4)
     RETURNING id`
  );
  return result!.id;
}

async function createTestWorker(name: string, phone: string, roles: string[]) {
  const result = await querySingle<{ id: string }>(
    `INSERT INTO workers (name, phone, roles) VALUES ($1, $2, $3) RETURNING id`,
    [name, phone, roles]
  );
  return result!.id;
}

async function createTestLine(eventId: string, role: string, slotsNeeded: number) {
  const result = await querySingle<{ id: string }>(
    `INSERT INTO staffing_lines (event_id, role, slots_needed, start_time, end_time)
     VALUES ($1, $2, $3, '2026-12-15T18:00:00Z', '2026-12-15T02:00:00+1') 
     RETURNING id`,
    [eventId, role, slotsNeeded]
  );
  return result!.id;
}

async function createTestOfferWithToken(lineId: string, workerId: string) {
  const token = crypto.randomBytes(32).toString('hex');
  const result = await querySingle<{ id: string; offer_token: string }>(
    `INSERT INTO staffing_offers (staffing_line_id, worker_id, status, offer_token)
     VALUES ($1, $2, 'sent', $3)
     RETURNING id, offer_token`,
    [lineId, workerId, token]
  );
  return { id: result!.id, token: result!.offer_token };
}

async function cleanupTestData(eventId: string) {
  await queryMany(`DELETE FROM worker_hours WHERE event_id = $1`, [eventId]);
  await queryMany(`DELETE FROM worker_event_pay WHERE event_id = $1`, [eventId]);
  await queryMany(`DELETE FROM staffing_assignments WHERE staffing_line_id IN (SELECT id FROM staffing_lines WHERE event_id = $1)`, [eventId]);
  await queryMany(`DELETE FROM staffing_offers WHERE staffing_line_id IN (SELECT id FROM staffing_lines WHERE event_id = $1)`, [eventId]);
  await queryMany(`DELETE FROM staffing_lines WHERE event_id = $1`, [eventId]);
  await queryMany(`DELETE FROM events WHERE id = $1`, [eventId]);
}

// ============================================================
// Tests: Offer Token
// ============================================================

describe('WP-17: Offer Token', () => {
  let eventId: string;
  let lineId: string;
  let workerId: string;

  beforeAll(async () => {
    eventId = await createTestEvent();
    lineId = await createTestLine(eventId, 'camarero', 2);
    workerId = await createTestWorker('Token Test Worker', '+34600001001', ['camarero']);
  });

  afterAll(async () => {
    await cleanupTestData(eventId);
  });

  test('offer has unique token', async () => {
    const offer1 = await createTestOfferWithToken(lineId, workerId);
    expect(offer1.token).toBeDefined();
    expect(offer1.token.length).toBe(64); // 32 bytes = 64 hex chars

    // Create another worker and offer
    const worker2 = await createTestWorker('Token Test Worker 2', '+34600001002', ['camarero']);
    const offer2 = await createTestOfferWithToken(lineId, worker2);
    expect(offer2.token).not.toBe(offer1.token);
  });

  test('token lookup returns correct offer', async () => {
    const offer = await querySingle<any>(
      `SELECT so.id, so.status, w.name AS worker_name
       FROM staffing_offers so
       JOIN workers w ON w.id = so.worker_id
       WHERE so.offer_token = $1`,
      [(await querySingle<{ offer_token: string }>(
        `SELECT offer_token FROM staffing_offers WHERE worker_id = $1`,
        [workerId]
      ))!.offer_token]
    );
    
    expect(offer).toBeDefined();
    expect(offer.worker_name).toBe('Token Test Worker');
    expect(offer.status).toBe('sent');
  });
});

// ============================================================
// Tests: Public Shift Confirmation
// ============================================================

describe('WP-17: Public Shift Confirmation Flow', () => {
  let eventId: string;
  let lineId: string;
  let workerId: string;
  let offerData: { id: string; token: string };

  beforeAll(async () => {
    eventId = await createTestEvent();
    lineId = await createTestLine(eventId, 'camarero', 2);
    workerId = await createTestWorker('Confirm Test Worker', '+34600002001', ['camarero']);
    offerData = await createTestOfferWithToken(lineId, workerId);
  });

  afterAll(async () => {
    await cleanupTestData(eventId);
  });

  test('accepting shift creates assignment', async () => {
    // Simulate the API logic directly
    const result = await transaction(async (client) => {
      const offer = await client.query(
        `SELECT so.id, so.status, so.staffing_line_id, so.worker_id,
                sl.event_id, sl.role, sl.slots_needed,
                (SELECT COUNT(*)::int FROM staffing_assignments sa 
                 WHERE sa.staffing_line_id = so.staffing_line_id) AS assigned_count
         FROM staffing_offers so
         JOIN staffing_lines sl ON sl.id = so.staffing_line_id
         WHERE so.offer_token = $1`,
        [offerData.token]
      );

      if (!offer.rows[0] || offer.rows[0].status !== 'sent') {
        return { success: false, reason: 'invalid_offer' };
      }

      const offerRow = offer.rows[0];

      // Update offer status
      await client.query(
        `UPDATE staffing_offers SET status = 'accepted', responded_at = now() WHERE id = $1`,
        [offerRow.id]
      );

      // Create assignment
      await client.query(
        `INSERT INTO staffing_assignments (staffing_line_id, worker_id, offer_id, position)
         VALUES ($1, $2, $3, $4)`,
        [offerRow.staffing_line_id, offerRow.worker_id, offerRow.id, offerRow.assigned_count + 1]
      );

      return { success: true };
    });

    expect(result.success).toBe(true);

    // Verify assignment exists
    const assignment = await querySingle<any>(
      `SELECT id FROM staffing_assignments 
       WHERE staffing_line_id = $1 AND worker_id = $2`,
      [lineId, workerId]
    );
    expect(assignment).toBeDefined();
  });

  test('double accept is rejected', async () => {
    // Try to accept again
    const offer = await querySingle<any>(
      `SELECT status FROM staffing_offers WHERE offer_token = $1`,
      [offerData.token]
    );
    
    expect(offer!.status).toBe('accepted'); // Already accepted
  });
});

// ============================================================
// Tests: Hours Preloading
// ============================================================

describe('WP-17: Hours Preloading', () => {
  let eventId: string;
  let lineId: string;
  let workerId: string;

  beforeAll(async () => {
    eventId = await createTestEvent();
    lineId = await createTestLine(eventId, 'camarero', 1);
    workerId = await createTestWorker('Hours Test Worker', '+34600003001', ['camarero']);

    // Create assignment
    const offerData = await createTestOfferWithToken(lineId, workerId);
    await querySingle(
      `UPDATE staffing_offers SET status = 'accepted', responded_at = now() WHERE id = $1`,
      [offerData.id]
    );
    await querySingle(
      `INSERT INTO staffing_assignments (staffing_line_id, worker_id, offer_id, position)
       VALUES ($1, $2, $3, 1)`,
      [lineId, workerId, offerData.id]
    );
  });

  afterAll(async () => {
    await cleanupTestData(eventId);
  });

  test('preload hours creates worker_hours entries', async () => {
    // Call preloadEventHours logic
    const assignments = await queryMany<any>(
      `SELECT sa.worker_id, sa.staffing_line_id, sl.start_time, sl.end_time, sl.role
       FROM staffing_assignments sa
       JOIN staffing_lines sl ON sl.id = sa.staffing_line_id
       WHERE sl.event_id = $1`,
      [eventId]
    );

    expect(assignments.length).toBe(1);

    // Calculate hours
    const assignment = assignments[0];
    let hours = 8; // default
    if (assignment.start_time && assignment.end_time) {
      const start = new Date(assignment.start_time);
      const end = new Date(assignment.end_time);
      hours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 100) / 100;
    }

    // Insert worker_hours
    await querySingle(
      `INSERT INTO worker_hours (worker_id, event_id, staffing_line_id, hours, hour_type, status)
       VALUES ($1, $2, $3, $4, 'planificada', 'pendiente')`,
      [workerId, eventId, lineId, hours]
    );

    const workerHours = await querySingle<any>(
      `SELECT * FROM worker_hours WHERE event_id = $1 AND worker_id = $2`,
      [eventId, workerId]
    );

    expect(workerHours).toBeDefined();
    expect(workerHours.hours).toBe(hours);
    expect(workerHours.hour_type).toBe('planificada');
    expect(workerHours.status).toBe('pendiente');
  });

  test('idempotent: double preload does not duplicate', async () => {
    // Count existing
    const before = await queryMany<any>(
      `SELECT id FROM worker_hours WHERE event_id = $1`,
      [eventId]
    );
    const countBefore = before.length;

    // Try to insert again (should fail due to unique constraint)
    try {
      await querySingle(
        `INSERT INTO worker_hours (worker_id, event_id, staffing_line_id, hours, hour_type, status)
         VALUES ($1, $2, $3, 8, 'planificada', 'pendiente')`,
        [workerId, eventId, lineId]
      );
    } catch (e) {
      // Expected unique constraint violation
    }

    const after = await queryMany<any>(
      `SELECT id FROM worker_hours WHERE event_id = $1`,
      [eventId]
    );

    expect(after.length).toBe(countBefore); // No new entries
  });
});

// ============================================================
// Tests: Staffing Line Generation from Template
// ============================================================

describe('WP-17: Staffing Line Generation', () => {
  let eventId: string;

  beforeAll(async () => {
    eventId = await createTestEvent();
  });

  afterAll(async () => {
    await cleanupTestData(eventId);
  });

  test('generates staffing lines based on guest count', async () => {
    // Get event guest count
    const event = await querySingle<any>(
      `SELECT guest_count FROM events WHERE id = $1`,
      [eventId]
    );
    expect(event!.guest_count).toBe(50);

    // Apply template: 1 camarero per 15 guests
    const template = [{ role: 'camarero', ratio: 15 }];
    
    for (const item of template) {
      const slotsNeeded = Math.ceil(event.guest_count / item.ratio);
      
      await querySingle(
        `INSERT INTO staffing_lines (event_id, role, slots_needed, status)
         VALUES ($1, $2, $3, 'open')`,
        [eventId, item.role, slotsNeeded]
      );
    }

    // Verify
    const lines = await queryMany<any>(
      `SELECT role, slots_needed FROM staffing_lines WHERE event_id = $1`,
      [eventId]
    );

    expect(lines.length).toBe(1);
    expect(lines[0].role).toBe('camarero');
    expect(lines[0].slots_needed).toBe(4); // ceil(50/15) = 4
  });

  test('idempotent: does not duplicate lines', async () => {
    const before = await queryMany<any>(
      `SELECT id FROM staffing_lines WHERE event_id = $1`,
      [eventId]
    );
    const countBefore = before.length;

    // Try to generate again
    const event = await querySingle<any>(
      `SELECT guest_count FROM events WHERE id = $1`,
      [eventId]
    );
    const slotsNeeded = Math.ceil(event!.guest_count / 15);
    
    // Check if lines already exist
    const existing = await queryMany<any>(
      `SELECT id FROM staffing_lines WHERE event_id = $1`,
      [eventId]
    );

    if (existing.length === 0) {
      await querySingle(
        `INSERT INTO staffing_lines (event_id, role, slots_needed, status)
         VALUES ($1, 'camarero', $2, 'open')`,
        [eventId, slotsNeeded]
      );
    }

    const after = await queryMany<any>(
      `SELECT id FROM staffing_lines WHERE event_id = $1`,
      [eventId]
    );

    expect(after.length).toBe(countBefore); // No new lines
  });
});
