/**
 * EventFlow — Tests para el worker de domain events (WP-04)
 * Tests de integración que verifican el procesamiento de eventos.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { query, querySingle, transaction } from '@/lib/db';
import { emitDomainEvent, getPendingEvents, markEventProcessed, recordEventError } from '@/domain/events';

describe('Domain Events Worker (WP-04)', () => {
  let testEventId: string;

  beforeAll(async () => {
    // Crear un evento de prueba para usar como aggregate_id
    const result = await querySingle<any>(
      `INSERT INTO events (client_name, client_email, event_type, guest_count, event_date, status)
       VALUES ('Test Client', 'test@example.com', 'boda', 100, '2026-12-31', 'draft')
       RETURNING id`
    );
    testEventId = result?.id;
  });

  afterAll(async () => {
    // Limpiar eventos de prueba
    if (testEventId) {
      await query(`DELETE FROM events WHERE id = $1`, [testEventId]);
    }
    await query(`DELETE FROM domain_events WHERE aggregate_id = $1`, [testEventId]);
  });

  beforeEach(async () => {
    // Limpiar domain_events de prueba antes de cada test
    await query(`DELETE FROM domain_events WHERE aggregate_id = $1`, [testEventId]);
  });

  describe('emitDomainEvent', () => {
    it('should create a domain event', async () => {
      await transaction(async (client) => {
        await emitDomainEvent(
          client,
          'event.confirmed',
          'event',
          testEventId,
          { event_id: testEventId, venue_type: 'benitez', pax: 100, date: '2026-12-31' }
        );
      });

      const events = await getPendingEvents();
      expect(events.length).toBeGreaterThan(0);
      
      const lastEvent = events[events.length - 1];
      expect(lastEvent.event_type).toBe('event.confirmed');
      expect(lastEvent.aggregate_type).toBe('event');
      expect(lastEvent.aggregate_id).toBe(testEventId);
      expect(lastEvent.payload).toHaveProperty('event_id', testEventId);
    });

    it('should store payload as JSONB', async () => {
      const payload = { nested: { data: true }, array: [1, 2, 3] };
      
      await transaction(async (client) => {
        await emitDomainEvent(
          client,
          'test.event',
          'test',
          testEventId,
          payload
        );
      });

      const events = await getPendingEvents();
      const lastEvent = events[events.length - 1];
      expect(lastEvent.payload).toEqual(payload);
    });
  });

  describe('getPendingEvents', () => {
    it('should return only unprocessed events', async () => {
      // Crear varios eventos
      await transaction(async (client) => {
        await emitDomainEvent(client, 'event.type1', 'event', testEventId, {});
        await emitDomainEvent(client, 'event.type2', 'event', testEventId, {});
      });

      const pending = await getPendingEvents();
      expect(pending.every(e => e.processed_at === null)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      // Crear varios eventos
      await transaction(async (client) => {
        for (let i = 0; i < 5; i++) {
          await emitDomainEvent(client, `event.type${i}`, 'event', testEventId, {});
        }
      });

      const limited = await getPendingEvents(2);
      expect(limited.length).toBeLessThanOrEqual(2);
    });
  });

  describe('markEventProcessed', () => {
    it('should mark event as processed', async () => {
      await transaction(async (client) => {
        await emitDomainEvent(client, 'event.to_process', 'event', testEventId, {});
      });

      const pending = await getPendingEvents();
      const eventToProcess = pending.find(e => e.event_type === 'event.to_process');
      expect(eventToProcess).toBeDefined();

      await markEventProcessed(eventToProcess!.id);

      const pendingAfter = await getPendingEvents();
      const processedEvent = pendingAfter.find(e => e.id === eventToProcess!.id);
      expect(processedEvent).toBeUndefined();
    });
  });

  describe('recordEventError', () => {
    it('should increment attempts and record error', async () => {
      await transaction(async (client) => {
        await emitDomainEvent(client, 'event.with_error', 'event', testEventId, {});
      });

      const pending = await getPendingEvents();
      const eventWithError = pending.find(e => e.event_type === 'event.with_error');
      expect(eventWithError).toBeDefined();

      await recordEventError(eventWithError!.id, 'Test error message');

      const pendingAfter = await getPendingEvents();
      const errorEvent = pendingAfter.find(e => e.id === eventWithError!.id);
      expect(errorEvent).toBeDefined();
      expect(errorEvent!.attempts).toBe(1);
      expect(errorEvent!.last_error).toBe('Test error message');
    });

    it('should accumulate attempts on multiple errors', async () => {
      await transaction(async (client) => {
        await emitDomainEvent(client, 'event.multi_error', 'event', testEventId, {});
      });

      const pending = await getPendingEvents();
      const event = pending.find(e => e.event_type === 'event.multi_error');
      
      await recordEventError(event!.id, 'Error 1');
      await recordEventError(event!.id, 'Error 2');
      await recordEventError(event!.id, 'Error 3');

      const pendingAfter = await getPendingEvents();
      const errorEvent = pendingAfter.find(e => e.id === event!.id);
      expect(errorEvent!.attempts).toBe(3);
      expect(errorEvent!.last_error).toBe('Error 3');
    });
  });

  describe('Idempotency', () => {
    it('should not process same event twice', async () => {
      await transaction(async (client) => {
        await emitDomainEvent(client, 'event.idempotent', 'event', testEventId, {});
      });

      const pending = await getPendingEvents();
      const event = pending.find(e => e.event_type === 'event.idempotent');
      
      // Mark as processed
      await markEventProcessed(event!.id);
      
      // Try to get pending again - should not include this event
      const pendingAfter = await getPendingEvents();
      const processedEvent = pendingAfter.find(e => e.id === event!.id);
      expect(processedEvent).toBeUndefined();
    });
  });
});