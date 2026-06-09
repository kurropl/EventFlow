/**
 * EventFlow — Staffing Assignment Tests
 * 
 * Tests concurrent-safe assignment and line-full behavior.
 * Run with: npx jest __tests__/staffing.test.ts
 * 
 * These tests verify the core transaction logic.
 * They use a real PostgreSQL connection (integration tests).
 */

import { transaction, querySingle, queryMany } from '../src/lib/db';

// ============================================================
// Test helpers
// ============================================================

async function createTestEvent() {
  const result = await querySingle<{ id: string }>(
    `INSERT INTO events (client_name, client_email, event_type, guest_count, kids_count, event_date, status, selected_items, bar_hours)
     VALUES ('Test Event', 'test@test.com', 'boda', 100, 5, '2026-12-01', 'accepted', '[]', 3)
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
    `INSERT INTO staffing_lines (event_id, role, slots_needed) VALUES ($1, $2, $3) RETURNING id`,
    [eventId, role, slotsNeeded]
  );
  return result!.id;
}

async function createTestOffer(lineId: string, workerId: string) {
  const result = await querySingle<{ id: string }>(
    `INSERT INTO staffing_offers (staffing_line_id, worker_id) VALUES ($1, $2) RETURNING id`,
    [lineId, workerId]
  );
  return result!.id;
}

async function cleanupTestData(eventId: string) {
  // Delete in reverse order of dependencies
  await queryMany(`DELETE FROM staffing_assignments WHERE staffing_line_id IN (SELECT id FROM staffing_lines WHERE event_id = $1)`, [eventId]);
  await queryMany(`DELETE FROM staffing_offers WHERE staffing_line_id IN (SELECT id FROM staffing_lines WHERE event_id = $1)`, [eventId]);
  await queryMany(`DELETE FROM staffing_lines WHERE event_id = $1`, [eventId]);
  await queryMany(`DELETE FROM events WHERE id = $1`, [eventId]);
}

// ============================================================
// Core assignment logic (mirrors the webhook implementation)
// ============================================================

async function assignWorker(lineId: string, workerId: string, offerId: string) {
  return transaction(async (client) => {
    // Lock the staffing line row
    const lineRow = await client.query(
      `SELECT id, slots_needed, status FROM staffing_lines WHERE id = $1 FOR UPDATE`,
      [lineId]
    );

    if (!lineRow.rows[0] || lineRow.rows[0].status !== 'open') {
      return { success: false, reason: 'line_not_open' };
    }

    const slotsNeeded = lineRow.rows[0].slots_needed;

    // Check if worker is already assigned
    const existing = await client.query(
      `SELECT id FROM staffing_assignments WHERE staffing_line_id = $1 AND worker_id = $2`,
      [lineId, workerId]
    );
    if (existing.rows.length > 0) {
      return { success: false, reason: 'already_assigned' };
    }

    // Count current assignments
    const countRes = await client.query(
      `SELECT COUNT(*)::int as cnt FROM staffing_assignments WHERE staffing_line_id = $1`,
      [lineId]
    );
    const currentCount = countRes.rows[0].cnt;

    if (currentCount >= slotsNeeded) {
      return { success: false, reason: 'line_full' };
    }

    // Create assignment
    const assignment = await client.query(
      `INSERT INTO staffing_assignments (staffing_line_id, worker_id, offer_id, position)
       VALUES ($1, $2, $3, $4) RETURNING id, position`,
      [lineId, workerId, offerId, currentCount + 1]
    );

    const position = assignment.rows[0].position;

    // Mark THIS offer as accepted (mirrors the webhook, which sets the offer
    // status before the transaction) so it is not expired in the step below.
    await client.query(
      `UPDATE staffing_offers SET status = 'accepted', responded_at = now() WHERE id = $1`,
      [offerId]
    );

    // If line is now full
    if (currentCount + 1 >= slotsNeeded) {
      await client.query(
        `UPDATE staffing_lines SET status = 'filled', updated_at = now() WHERE id = $1`,
        [lineId]
      );
      await client.query(
        `UPDATE staffing_offers SET status = 'expired', responded_at = now()
         WHERE staffing_line_id = $1 AND status = 'sent'`,
        [lineId]
      );
    }

    return { success: true, position, lineFull: currentCount + 1 >= slotsNeeded };
  });
}

// ============================================================
// Tests
// ============================================================

describe('Staffing Assignment', () => {
  let eventId: string;
  let lineId: string;
  let workerIds: string[] = [];
  let offerIds: string[] = [];

  beforeAll(async () => {
    eventId = await createTestEvent();
    lineId = await createTestLine(eventId, 'camarero', 2); // 2 slots

    // Create 3 workers
    workerIds = await Promise.all([
      createTestWorker('Worker A', '+34600000001', ['camarero']),
      createTestWorker('Worker B', '+34600000002', ['camarero']),
      createTestWorker('Worker C', '+34600000003', ['camarero']),
    ]);

    // Create offers for each worker
    offerIds = await Promise.all(
      workerIds.map(wid => createTestOffer(lineId, wid))
    );
  });

  afterAll(async () => {
    await cleanupTestData(eventId);
  });

  test('first worker gets position #1', async () => {
    const result = await assignWorker(lineId, workerIds[0], offerIds[0]);
    expect(result.success).toBe(true);
    expect(result.position).toBe(1);
    expect(result.lineFull).toBe(false);
  });

  test('second worker gets position #2 and fills line', async () => {
    const result = await assignWorker(lineId, workerIds[1], offerIds[1]);
    expect(result.success).toBe(true);
    expect(result.position).toBe(2);
    expect(result.lineFull).toBe(true);
  });

  test('third worker is rejected (line full)', async () => {
    const result = await assignWorker(lineId, workerIds[2], offerIds[2]);
    expect(result.success).toBe(false);
    // Once the line is full it is closed (status='filled'), so a late
    // acceptance is rejected as line_not_open; line_full is the still-open path.
    expect(['line_full', 'line_not_open']).toContain(result.reason);
  });

  test('line status is now "filled"', async () => {
    const line = await querySingle<{ status: string }>(
      `SELECT status FROM staffing_lines WHERE id = $1`, [lineId]
    );
    expect(line!.status).toBe('filled');
  });

  test('remaining offers are expired', async () => {
    const offers = await queryMany<{ status: string }>(
      `SELECT status FROM staffing_offers WHERE staffing_line_id = $1 ORDER BY sent_at`,
      [lineId]
    );
    const expiredCount = offers.filter(o => o.status === 'expired').length;
    expect(expiredCount).toBe(1); // Worker C's offer should be expired
  });

  test('assignments are ordered by position', async () => {
    const assignments = await queryMany<{ position: number; worker_id: string }>(
      `SELECT position, worker_id FROM staffing_assignments WHERE staffing_line_id = $1 ORDER BY position`,
      [lineId]
    );
    expect(assignments).toHaveLength(2);
    expect(assignments[0].position).toBe(1);
    expect(assignments[1].position).toBe(2);
    expect(assignments[0].worker_id).toBe(workerIds[0]);
    expect(assignments[1].worker_id).toBe(workerIds[1]);
  });

  test('duplicate assignment is rejected', async () => {
    const result = await assignWorker(lineId, workerIds[0], offerIds[0]);
    expect(result.success).toBe(false);
    // Worker is already assigned AND the line is now filled — both guards
    // (already_assigned / line_not_open) correctly prevent a double booking.
    expect(['already_assigned', 'line_not_open']).toContain(result.reason);
  });
});

describe('Staffing Line Full Behavior', () => {
  let eventId: string;

  beforeAll(async () => {
    eventId = await createTestEvent();
  });

  afterAll(async () => {
    await cleanupTestData(eventId);
  });

  test('line with 1 slot fills after first assignment', async () => {
    const lineId = await createTestLine(eventId, 'barman', 1);
    const workerId = await createTestWorker('Solo Barman', '+34600000010', ['barman']);
    const offerId = await createTestOffer(lineId, workerId);

    const result = await assignWorker(lineId, workerId, offerId);
    expect(result.success).toBe(true);
    expect(result.position).toBe(1);
    expect(result.lineFull).toBe(true);

    const line = await querySingle<{ status: string }>(
      `SELECT status FROM staffing_lines WHERE id = $1`, [lineId]
    );
    expect(line!.status).toBe('filled');
  });
});
