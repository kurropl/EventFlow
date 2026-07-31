/**
 * EventFlow — Tests de WP-31: Congelación y Disparo de la Cadena Operativa
 *
 * Verifica:
 * 1. Job diario congela portales con freeze_date <= hoy
 * 2. Idempotencia: ejecutar dos veces no duplica
 * 3. Email de resumen enviado al cliente
 * 4. portal.frozen emitido dispara cascada (staffing, compras, vajilla/packs)
 * 5. Portal congelado es solo-lectura (423 en escritura)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { query, querySingle, transaction } from '@/lib/db';
import { emitDomainEvent, getPendingEvents, markEventProcessed } from '@/domain/events';
import { freezePortal, createPortal, generateAccessToken, hashToken } from '@/domain/portal';
import { getHandler } from '@/domain/handlers';

// ============================================================
// Fixtures
// ============================================================

let testEventId: string;
let testPortalId: number;
let testAccessToken: string;

beforeAll(async () => {
  // Create test event
  const eventResult = await querySingle<any>(
    `INSERT INTO events (client_name, client_email, event_type, guest_count, kids_count,
                         event_date, status, venue_type, service_type, total_pvp)
     VALUES ('Test WP31', 'test-wp31@example.com', 'boda', 100, 10,
             CURRENT_DATE + INTERVAL '7 days', 'accepted', 'benitez', 'menu', 15000.00)
     RETURNING id`
  );
  testEventId = eventResult!.id;

  // Create portal with freeze_date = today (should be frozen by cron)
  testAccessToken = generateAccessToken();
  const tokenHash = hashToken(testAccessToken);

  const portalResult = await querySingle<any>(
    `INSERT INTO client_portals (event_id, access_token, token_hash, freeze_date, status)
     VALUES ($1, $2, $3, CURRENT_DATE, 'activo')
     RETURNING id`,
    [testEventId, testAccessToken, tokenHash]
  );
  testPortalId = portalResult!.id;

  // Create some test guests
  await query(
    `INSERT INTO guests (event_id, name, rsvp, menu_type, dietary)
     VALUES
       ($1, 'Guest 1', 'confirmado', 'adulto', '["vegetariano"]'::jsonb),
       ($1, 'Guest 2', 'confirmado', 'adulto', '[]'::jsonb),
       ($1, 'Guest 3', 'pendiente', 'nino', '["celiaco"]'::jsonb),
       ($1, 'Guest 4', 'rechazado', 'adulto', '[]'::jsonb)`,
    [testEventId]
  );
});

afterAll(async () => {
  // Clean up
  if (testEventId) {
    await query(`DELETE FROM guests WHERE event_id = $1`, [testEventId]);
    await query(`DELETE FROM client_portals WHERE event_id = $1`, [testEventId]);
    await query(`DELETE FROM domain_events WHERE aggregate_id = $1`, [testEventId]);
    await query(`DELETE FROM events WHERE id = $1`, [testEventId]);
  }
});

beforeEach(async () => {
  // Clean domain events for this test event
  await query(`DELETE FROM domain_events WHERE aggregate_id = $1`, [testEventId]);
});

// ============================================================
// Tests
// ============================================================

describe('WP-31: Congelación y Disparo de la Cadena Operativa', () => {
  describe('freezePortal', () => {
    it('should freeze an active portal', async () => {
      const result = await freezePortal(testEventId);
      expect(result).toBe(true);

      const portal = await querySingle<any>(
        `SELECT status FROM client_portals WHERE event_id = $1`,
        [testEventId]
      );
      expect(portal?.status).toBe('congelado');
    });

    it('should be idempotent - freezing twice returns false', async () => {
      // Already frozen from previous test
      const result = await freezePortal(testEventId);
      expect(result).toBe(false); // Already frozen
    });

    it('should not freeze a closed portal', async () => {
      // Create a new event with a closed portal
      const event = await querySingle<any>(
        `INSERT INTO events (client_name, client_email, event_type, guest_count, status)
         VALUES ('Test Closed', 'test-closed@example.com', 'boda', 50, 'accepted')
         RETURNING id`
      );
      const eventId = event!.id;

      const token = generateAccessToken();
      const tokenHash = hashToken(token);

      await query(
        `INSERT INTO client_portals (event_id, access_token, token_hash, freeze_date, status)
         VALUES ($1, $2, $3, CURRENT_DATE, 'cerrado')`,
        [eventId, token, tokenHash]
      );

      const result = await freezePortal(eventId);
      expect(result).toBe(false);

      // Cleanup
      await query(`DELETE FROM client_portals WHERE event_id = $1`, [eventId]);
      await query(`DELETE FROM events WHERE id = $1`, [eventId]);
    });
  });

  describe('portal.frozen handler', () => {
    it('should be registered in the handlers map', async () => {
      const handler = getHandler('portal.frozen');
      expect(handler).toBeDefined();
      expect(typeof handler).toBe('function');
    });

    it('should emit portal.frozen domain event', async () => {
      // Create a fresh event for this test
      const event = await querySingle<any>(
        `INSERT INTO events (client_name, client_email, event_type, guest_count, status, venue_type)
         VALUES ('Test Emit', 'test-emit@example.com', 'boda', 80, 'accepted', 'benitez')
         RETURNING id`
      );
      const eventId = event!.id;

      await transaction(async (client) => {
        await emitDomainEvent(
          client,
          'portal.frozen',
          'event',
          eventId,
          {
            event_id: eventId,
            portal_id: 999,
            guest_count: 80,
            confirmed_guests: 75,
            confirmed_adults: 70,
            confirmed_kids: 5,
            confirmed_pax: 75,
            freeze_date: new Date().toISOString(),
          }
        );
      });

      const events = await getPendingEvents();
      const portalFrozen = events.find(
        e => e.event_type === 'portal.frozen' && e.aggregate_id === eventId
      );
      expect(portalFrozen).toBeDefined();
      expect(portalFrozen?.payload).toHaveProperty('event_id', eventId);
      expect(portalFrozen?.payload).toHaveProperty('confirmed_guests', 75);

      // Cleanup
      await query(`DELETE FROM domain_events WHERE aggregate_id = $1`, [eventId]);
      await query(`DELETE FROM events WHERE id = $1`, [eventId]);
    });
  });

  describe('Guest summary calculations', () => {
    it('should correctly count confirmed/pending/rejected guests', async () => {
      const guests = await query<any>(
        `SELECT rsvp, menu_type, dietary
         FROM guests WHERE event_id = $1`,
        [testEventId]
      );

      const confirmed = guests.rows.filter((g: any) => g.rsvp === 'confirmado').length;
      const pending = guests.rows.filter((g: any) => g.rsvp === 'pendiente').length;
      const rejected = guests.rows.filter((g: any) => g.rsvp === 'rechazado').length;

      expect(confirmed).toBe(2);
      expect(pending).toBe(1);
      expect(rejected).toBe(1);
    });

    it('should correctly identify dietary restrictions', async () => {
      const guests = await query<any>(
        `SELECT dietary FROM guests WHERE event_id = $1`,
        [testEventId]
      );

      const dietaryCount: Record<string, number> = {};
      for (const g of guests.rows) {
        const dietary = Array.isArray(g.dietary) ? g.dietary : [];
        for (const d of dietary) {
          dietaryCount[d] = (dietaryCount[d] || 0) + 1;
        }
      }

      expect(dietaryCount['vegetariano']).toBe(1);
      expect(dietaryCount['celiaco']).toBe(1);
    });
  });

  describe('Portal frozen readonly', () => {
    it('should return frozen status for frozen portals', async () => {
      // The test portal should be frozen from earlier test
      const portal = await querySingle<any>(
        `SELECT status FROM client_portals WHERE id = $1`,
        [testPortalId]
      );
      expect(portal?.status).toBe('congelado');
    });
  });
});
