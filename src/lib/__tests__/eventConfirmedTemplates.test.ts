/**
 * EventFlow — Tests para el handler event.confirmed (WP-15)
 * Tests de integración que verifican la generación de plantillas por venue_type.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { query, querySingle, transaction } from '@/lib/db';
import { emitDomainEvent } from '@/domain/events';
import { handleEventConfirmed } from '@/domain/handlers/eventConfirmed';

describe('Event Confirmed Templates (WP-15)', () => {
  let testEventBenitez: string;
  let testEventExterno: string;
  let originalTemplates: any;

  beforeAll(async () => {
    // Guardar plantillas originales para restaurar después
    const settings = await querySingle<any>(
      `SELECT event_templates FROM business_settings LIMIT 1`
    );
    originalTemplates = settings?.event_templates;

    // Crear eventos de prueba
    const eventBenitez = await querySingle<any>(
      `INSERT INTO events (client_name, client_email, event_type, venue_type, guest_count, event_date, status)
       VALUES ('Test Cliente Benitez', 'test-benitez@example.com', 'boda', 'benitez', 80, '2026-12-31', 'draft')
       RETURNING id`
    );
    testEventBenitez = eventBenitez?.id;

    const eventExterno = await querySingle<any>(
      `INSERT INTO events (client_name, client_email, event_type, venue_type, guest_count, event_date, status)
       VALUES ('Test Cliente Externo', 'test-externo@example.com', 'corporativo', 'externo', 150, '2026-12-15', 'draft')
       RETURNING id`
    );
    testEventExterno = eventExterno?.id;
  });

  afterAll(async () => {
    // Limpiar eventos de prueba
    if (testEventBenitez) {
      await query(`DELETE FROM event_plans WHERE event_id = $1`, [testEventBenitez]);
      await query(`DELETE FROM checklist_tasks WHERE event_id = $1`, [testEventBenitez]);
      await query(`DELETE FROM events WHERE id = $1`, [testEventBenitez]);
    }
    if (testEventExterno) {
      await query(`DELETE FROM event_plans WHERE event_id = $1`, [testEventExterno]);
      await query(`DELETE FROM checklist_tasks WHERE event_id = $1`, [testEventExterno]);
      await query(`DELETE FROM events WHERE id = $1`, [testEventExterno]);
    }

    // Restaurar plantillas originales
    if (originalTemplates) {
      await query(
        `UPDATE business_settings SET event_templates = $1`,
        [JSON.stringify(originalTemplates)]
      );
    }
  });

  beforeEach(async () => {
    // Limpiar items existentes antes de cada test
    if (testEventBenitez) {
      await query(`DELETE FROM event_plans WHERE event_id = $1`, [testEventBenitez]);
      await query(`DELETE FROM checklist_tasks WHERE event_id = $1`, [testEventBenitez]);
    }
    if (testEventExterno) {
      await query(`DELETE FROM event_plans WHERE event_id = $1`, [testEventExterno]);
      await query(`DELETE FROM checklist_tasks WHERE event_id = $1`, [testEventExterno]);
    }
  });

  describe('Venue tipo Benítez (interno)', () => {
    it('should create checklist items for benitez venue', async () => {
      const event: DomainEvent = {
        id: 999001,
        event_type: 'event.confirmed',
        aggregate_type: 'event',
        aggregate_id: testEventBenitez,
        payload: {
          event_id: testEventBenitez,
          venue_type: 'benitez',
          pax: 80,
          date: '2026-12-31',
        },
        created_at: new Date(),
        processed_at: null,
        attempts: 0,
        last_error: null,
      };

      await handleEventConfirmed(event);

      const checklistItems = await query<any>(
        `SELECT * FROM checklist_tasks WHERE event_id = $1 ORDER BY sort_order`,
        [testEventBenitez]
      );

      expect(checklistItems.rows.length).toBeGreaterThan(0);
      expect(checklistItems.rows.some((i: any) => i.title.includes('sala'))).toBe(true);
    });

    it('should create table map for benitez venue', async () => {
      const event: DomainEvent = {
        id: 999002,
        event_type: 'event.confirmed',
        aggregate_type: 'event',
        aggregate_id: testEventBenitez,
        payload: {
          event_id: testEventBenitez,
          venue_type: 'benitez',
          pax: 80,
          date: '2026-12-31',
        },
        created_at: new Date(),
        processed_at: null,
        attempts: 0,
        last_error: null,
      };

      await handleEventConfirmed(event);

      const tableMap = await querySingle<any>(
        `SELECT * FROM event_plans WHERE event_id = $1 AND category = 'mapa_mesas'`,
        [testEventBenitez]
      );

      expect(tableMap).toBeTruthy();
      expect(tableMap?.title).toContain('mesas');
    });
  });

  describe('Venue tipo Externo', () => {
    it('should create logistics items for externo venue', async () => {
      const event: DomainEvent = {
        id: 999003,
        event_type: 'event.confirmed',
        aggregate_type: 'event',
        aggregate_id: testEventExterno,
        payload: {
          event_id: testEventExterno,
          venue_type: 'externo',
          pax: 150,
          date: '2026-12-15',
        },
        created_at: new Date(),
        processed_at: null,
        attempts: 0,
        last_error: null,
      };

      await handleEventConfirmed(event);

      const logisticsItems = await query<any>(
        `SELECT * FROM event_plans WHERE event_id = $1 AND category = 'logistica' ORDER BY sort_order`,
        [testEventExterno]
      );

      expect(logisticsItems.rows.length).toBeGreaterThan(0);
      expect(logisticsItems.rows.some((i: any) => i.title.toLowerCase().includes('vehicle'))).toBe(true);
    });

    it('should create timing items for externo venue', async () => {
      const event: DomainEvent = {
        id: 999004,
        event_type: 'event.confirmed',
        aggregate_type: 'event',
        aggregate_id: testEventExterno,
        payload: {
          event_id: testEventExterno,
          venue_type: 'externo',
          pax: 150,
          date: '2026-12-15',
        },
        created_at: new Date(),
        processed_at: null,
        attempts: 0,
        last_error: null,
      };

      await handleEventConfirmed(event);

      const timingItems = await query<any>(
        `SELECT * FROM event_plans WHERE event_id = $1 AND category = 'timing' ORDER BY sort_order`,
        [testEventExterno]
      );

      expect(timingItems.rows.length).toBeGreaterThan(0);
      expect(timingItems.rows.some((i: any) => i.title.toLowerCase().includes('arribada'))).toBe(true);
    });

    it('should create APPCC center for externo venue', async () => {
      const event: DomainEvent = {
        id: 999005,
        event_type: 'event.confirmed',
        aggregate_type: 'event',
        aggregate_id: testEventExterno,
        payload: {
          event_id: testEventExterno,
          venue_type: 'externo',
          pax: 150,
          date: '2026-12-15',
        },
        created_at: new Date(),
        processed_at: null,
        attempts: 0,
        last_error: null,
      };

      await handleEventConfirmed(event);

      const appccCenter = await querySingle<any>(
        `SELECT * FROM event_plans WHERE event_id = $1 AND category = 'appcc'`,
        [testEventExterno]
      );

      expect(appccCenter).toBeTruthy();
      expect(appccCenter?.title).toContain('APPCC');
      expect(appccCenter?.title).toContain('Truck');
    });
  });

  describe('Idempotency', () => {
    it('should not duplicate templates when confirming twice', async () => {
      const event: DomainEvent = {
        id: 999006,
        event_type: 'event.confirmed',
        aggregate_type: 'event',
        aggregate_id: testEventExterno,
        payload: {
          event_id: testEventExterno,
          venue_type: 'externo',
          pax: 150,
          date: '2026-12-15',
        },
        created_at: new Date(),
        processed_at: null,
        attempts: 0,
        last_error: null,
      };

      // Primera confirmación
      await handleEventConfirmed(event);

      const countAfterFirst = await querySingle<any>(
        `SELECT COUNT(*)::int as count FROM event_plans WHERE event_id = $1`,
        [testEventExterno]
      );

      // Segunda confirmación (debería ser idempotente)
      await handleEventConfirmed(event);

      const countAfterSecond = await querySingle<any>(
        `SELECT COUNT(*)::int as count FROM event_plans WHERE event_id = $1`,
        [testEventExterno]
      );

      expect(countAfterSecond?.count).toBe(countAfterFirst?.count);
    });
  });

  describe('Custom templates', () => {
    it('should use custom templates from business_settings', async () => {
      // Actualizar plantillas personalizadas
      const customTemplates = {
        benitez: {
          checklist: [
            { title: 'Checklist personalizado 1', description: 'Descripción 1', sort_order: 1 },
            { title: 'Checklist personalizado 2', description: 'Descripción 2', sort_order: 2 },
          ],
        },
      };

      await query(
        `UPDATE business_settings SET event_templates = $1`,
        [JSON.stringify(customTemplates)]
      );

      const event: DomainEvent = {
        id: 999007,
        event_type: 'event.confirmed',
        aggregate_type: 'event',
        aggregate_id: testEventBenitez,
        payload: {
          event_id: testEventBenitez,
          venue_type: 'benitez',
          pax: 80,
          date: '2026-12-31',
        },
        created_at: new Date(),
        processed_at: null,
        attempts: 0,
        last_error: null,
      };

      await handleEventConfirmed(event);

      const checklistItems = await query<any>(
        `SELECT * FROM checklist_tasks WHERE event_id = $1 ORDER BY sort_order`,
        [testEventBenitez]
      );

      expect(checklistItems.rows.length).toBe(2);
      expect(checklistItems.rows[0].title).toBe('Checklist personalizado 1');
      expect(checklistItems.rows[1].title).toBe('Checklist personalizado 2');

      // Restaurar plantillas originales
      if (originalTemplates) {
        await query(
          `UPDATE business_settings SET event_templates = $1`,
          [JSON.stringify(originalTemplates)]
        );
      }
    });
  });
});

// Type needed for the test
interface DomainEvent {
  id: number;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  created_at: Date;
  processed_at: Date | null;
  attempts: number;
  last_error: string | null;
}
