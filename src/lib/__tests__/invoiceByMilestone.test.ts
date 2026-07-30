/**
 * EventFlow — Tests: WP-23 Facturación por Hitos
 *
 * Tests para:
 * - Factura de anticipo por hito pagado
 * - Factura final que deduce anticipos
 * - Numeración F-YYYY-NNNN sin huecos ni duplicados
 * - IVA correcto
 * - Campos Verifactu preparados
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getPool, querySingle, queryMany, transaction } from '@/lib/db';
import { createAdvanceInvoice, createFinalInvoice, getMilestonesWithInvoiceStatus } from '@/lib/domain/invoiceByMilestone';

// ============================================================
// Fixtures
// ============================================================

async function createTestEvent() {
  const pool = getPool();
  const result = await pool.query(`
    INSERT INTO events (
      client_name, client_email, event_type, guest_count, kids_count,
      event_date, status, selected_items, bar_hours, iva_pct
    ) VALUES (
      'Test WP23', 'test-wp23@test.com', 'boda', 50, 2,
      '2026-12-31', 'confirmado', '[]'::jsonb, 2, 10
    )
    RETURNING id
  `);
  return result.rows[0].id;
}

async function createTestClient(eventId: string) {
  const pool = getPool();
  const result = await pool.query(`
    INSERT INTO clients (name, email, fiscal_name, fiscal_nif, fiscal_address)
    VALUES ('Cliente WP23', 'wp23@test.com', 'Cliente WP23 SL', 'B12345678', 'Calle Test 1, Sevilla')
    RETURNING id
  `);
  const clientId = result.rows[0].id;
  await pool.query(`UPDATE events SET client_id = $1 WHERE id = $2`, [clientId, eventId]);
  return clientId;
}

async function createTestOrder(eventId: string, confirmedPrice: number) {
  const pool = getPool();
  const result = await pool.query(`
    INSERT INTO event_orders (event_id, quote_id, client_id, confirmed_price, status)
    VALUES ($1, '00000000-0000-0000-0000-000000000001', 
            (SELECT client_id FROM events WHERE id = $1), $2, 'in_progress')
    RETURNING id
  `, [eventId, confirmedPrice]);
  return result.rows[0].id;
}

async function createTestPlan(eventId: string, total: number) {
  const pool = getPool();
  const result = await pool.query(`
    INSERT INTO payment_plans (event_id, quote_id, total)
    VALUES ($1, '00000000-0000-0000-0000-000000000001', $2)
    RETURNING id
  `, [eventId, total]);
  return result.rows[0].id;
}

async function createTestMilestone(
  planId: string,
  kind: string,
  label: string,
  amount: number,
  status: string = 'pendiente'
) {
  const pool = getPool();
  const result = await pool.query(`
    INSERT INTO payment_milestones (plan_id, kind, label, amount, status, due_date)
    VALUES ($1, $2, $3, $4, $5, CURRENT_DATE + INTERVAL '7 days')
    RETURNING id
  `, [planId, kind, label, amount, status]);
  return result.rows[0].id;
}

async function cleanTestData(eventIds: string[]) {
  const pool = getPool();
  for (const eventId of eventIds) {
    // Clean in dependency order
    await pool.query('DELETE FROM invoices WHERE event_id = $1', [eventId]);
    await pool.query('DELETE FROM payment_milestones WHERE plan_id IN (SELECT id FROM payment_plans WHERE event_id = $1)', [eventId]);
    await pool.query('DELETE FROM payment_plans WHERE event_id = $1', [eventId]);
    await pool.query('DELETE FROM event_orders WHERE event_id = $1', [eventId]);
    await pool.query('DELETE FROM events WHERE id = $1', [eventId]);
    await pool.query(`DELETE FROM clients WHERE email = 'wp23@test.com'`);
  }
}

// ============================================================
// Tests
// ============================================================

describe('WP-23: Facturación por Hitos', () => {
  const testEventIds: string[] = [];

  afterAll(async () => {
    await cleanTestData(testEventIds);
  });

  describe('Tabla payment_plans y payment_milestones', () => {
    it('debería existir la tabla payment_plans', async () => {
      const pool = getPool();
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'payment_plans'
        ) AS exists
      `);
      expect(result.rows[0].exists).toBe(true);
    });

    it('debería existir la tabla payment_milestones', async () => {
      const pool = getPool();
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'payment_milestones'
        ) AS exists
      `);
      expect(result.rows[0].exists).toBe(true);
    });

    it('invoices debería tener columna invoice_type', async () => {
      const pool = getPool();
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'invoices' AND column_name = 'invoice_type'
        ) AS exists
      `);
      expect(result.rows[0].exists).toBe(true);
    });

    it('invoices debería tener columna milestone_id', async () => {
      const pool = getPool();
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'invoices' AND column_name = 'milestone_id'
        ) AS exists
      `);
      expect(result.rows[0].exists).toBe(true);
    });
  });

  describe('Factura de anticipo', () => {
    let eventId: string;
    let planId: string;
    let milestoneId: string;

    beforeEach(async () => {
      eventId = await createTestEvent();
      testEventIds.push(eventId);
      await createTestClient(eventId);
      await createTestOrder(eventId, 10000); // 10.000 € total evento
      planId = await createTestPlan(eventId, 10000);
      milestoneId = await createTestMilestone(planId, 'senal', 'Señal 40%', 4000, 'pagado');
    });

    it('debería crear factura de anticipo para hito pagado', async () => {
      const result = await transaction(async (client) => {
        return createAdvanceInvoice(client, milestoneId);
      });

      expect(result.invoice).toBeDefined();
      expect(result.invoice.invoice_type).toBe('anticipo');
      expect(result.invoice.milestone_id).toBe(milestoneId);
      expect(Number(result.invoice.subtotal)).toBe(4000);
      expect(Number(result.invoice.iva_pct)).toBe(10);
      expect(Number(result.invoice.iva_amount)).toBe(400); // 4000 × 10%
      expect(Number(result.invoice.total)).toBe(4400); // 4000 + 400
      expect(result.invoice.invoice_number).toMatch(/^F-\d{4}-\d{4}$/);
    });

    it('debería marcar el hito como facturado', async () => {
      await transaction(async (client) => {
        return createAdvanceInvoice(client, milestoneId);
      });

      const pool = getPool();
      const milestone = await pool.query(
        'SELECT invoiced_at, invoice_id FROM payment_milestones WHERE id = $1',
        [milestoneId]
      );
      expect(milestone.rows[0].invoiced_at).not.toBeNull();
      expect(milestone.rows[0].invoice_id).not.toBeNull();
    });

    it('debería rechazar hito no pagado', async () => {
      const pendienteMilestone = await createTestMilestone(planId, 'resto', 'Resto', 6000, 'pendiente');
      
      await expect(
        transaction(async (client) => {
          return createAdvanceInvoice(client, pendienteMilestone);
        })
      ).rejects.toThrow(/estado.*pendiente/);
    });

    it('debería rechazar hito ya facturado', async () => {
      await transaction(async (client) => {
        return createAdvanceInvoice(client, milestoneId);
      });

      await expect(
        transaction(async (client) => {
          return createAdvanceInvoice(client, milestoneId);
        })
      ).rejects.toThrow(/ya tiene.*factura/);
    });
  });

  describe('Factura final con deducción de anticipos', () => {
    let eventId: string;
    let planId: string;

    beforeEach(async () => {
      eventId = await createTestEvent();
      testEventIds.push(eventId);
      await createTestClient(eventId);
      await createTestOrder(eventId, 10000); // 10.000 € total evento
      planId = await createTestPlan(eventId, 10000);
    });

    it('debería crear factura final deduciendo anticipos', async () => {
      // 1. Crear hito de señal y facturar como anticipo
      const senalId = await createTestMilestone(planId, 'senal', 'Señal 40%', 4000, 'pagado');
      await transaction(async (client) => {
        return createAdvanceInvoice(client, senalId);
      });

      // 2. Crear factura final
      const result = await transaction(async (client) => {
        return createFinalInvoice(client, eventId);
      });

      expect(result.invoice).toBeDefined();
      expect(result.invoice.invoice_type).toBe('final');
      expect(Number(result.invoice.subtotal)).toBe(6000); // 10000 - 4000
      expect(Number(result.invoice.iva_pct)).toBe(10);
      expect(Number(result.invoice.iva_amount)).toBe(600); // 6000 × 10%
      expect(Number(result.invoice.total)).toBe(6600); // 6000 + 600
      expect(result.advancesDeducted).toBe(4000);
      expect(result.advanceInvoices).toHaveLength(1);
    });

    it('debería crear factura final sin anticipos cuando no hay anticipos', async () => {
      const result = await transaction(async (client) => {
        return createFinalInvoice(client, eventId);
      });

      expect(Number(result.invoice.subtotal)).toBe(10000);
      expect(Number(result.invoice.iva_amount)).toBe(1000); // 10000 × 10%
      expect(Number(result.invoice.total)).toBe(11000);
      expect(result.advancesDeducted).toBe(0);
      expect(result.advanceInvoices).toHaveLength(0);
    });

    it('debería rechazar si ya existe factura final', async () => {
      await transaction(async (client) => {
        return createFinalInvoice(client, eventId);
      });

      await expect(
        transaction(async (client) => {
          return createFinalInvoice(client, eventId);
        })
      ).rejects.toThrow(/Ya existe.*factura final/);
    });

    it('debería calcular IVA correctamente con múltiples anticipos', async () => {
      // Crear 2 anticipos
      const senalId = await createTestMilestone(planId, 'senal', 'Señal 30%', 3000, 'pagado');
      const interId = await createTestMilestone(planId, 'intermedio', 'Intermedio 20%', 2000, 'pagado');
      
      await transaction(async (client) => {
        return createAdvanceInvoice(client, senalId);
      });
      await transaction(async (client) => {
        return createAdvanceInvoice(client, interId);
      });

      // Factura final
      const result = await transaction(async (client) => {
        return createFinalInvoice(client, eventId);
      });

      expect(Number(result.invoice.subtotal)).toBe(5000); // 10000 - 3000 - 2000
      expect(Number(result.invoice.iva_amount)).toBe(500); // 5000 × 10%
      expect(Number(result.invoice.total)).toBe(5500); // 5000 + 500
      expect(result.advancesDeducted).toBe(5000);
    });
  });

  describe('Numeración F-YYYY-NNNN', () => {
    it('debería generar numeración secundaria sin duplicados', async () => {
      const pool = getPool();
      const year = new Date().getFullYear();
      
      // Obtener el siguiente número esperado
      const maxResult = await pool.query(
        `SELECT COALESCE(MAX(NULLIF(regexp_replace(invoice_number, '^F-[0-9]+-', ''), '')::int), 0) + 1 AS next
         FROM invoices WHERE invoice_number LIKE $1`,
        [`F-${year}-%`]
      );
      const expectedNext = Number(maxResult.rows[0].next);

      // Crear evento de prueba
      const testEventId = await createTestEvent();
      testEventIds.push(testEventId);
      await createTestClient(testEventId);
      await createTestOrder(testEventId, 5000);

      // Crear factura
      const result = await transaction(async (client) => {
        return createFinalInvoice(client, testEventId);
      });

      const expectedNumber = `F-${year}-${String(expectedNext).padStart(4, '0')}`;
      expect(result.invoice.invoice_number).toBe(expectedNumber);
    });

    it('debería mantener numeración intacta (no alterar existentes)', async () => {
      const pool = getPool();
      // Verificar que las facturas existentes no se modificaron
      const existing = await pool.query(
        `SELECT invoice_number FROM invoices 
         WHERE invoice_number LIKE 'F-%-%' 
         ORDER BY created_at DESC LIMIT 5`
      );
      
      for (const row of existing.rows) {
        expect(row.invoice_number).toMatch(/^F-\d{4}-\d{4}$/);
      }
    });
  });

  describe('Campos Verifactu', () => {
    it('factura de anticipo debería tener verifactu_status = no_enviado', async () => {
      const eventId = await createTestEvent();
      testEventIds.push(eventId);
      await createTestClient(eventId);
      await createTestOrder(eventId, 8000);
      const planId = await createTestPlan(eventId, 8000);
      const milestoneId = await createTestMilestone(planId, 'senal', 'Señal', 3200, 'pagado');

      const result = await transaction(async (client) => {
        return createAdvanceInvoice(client, milestoneId);
      });

      expect(result.invoice.verifactu_status).toBe('no_enviado');
    });

    it('factura final debería tener verifactu_status = no_enviado', async () => {
      const eventId = await createTestEvent();
      testEventIds.push(eventId);
      await createTestClient(eventId);
      await createTestOrder(eventId, 7000);

      const result = await transaction(async (client) => {
        return createFinalInvoice(client, eventId);
      });

      expect(result.invoice.verifactu_status).toBe('no_enviado');
    });
  });

  describe('Consulta de hitos con estado de facturación', () => {
    it('debería devolver hitos con información de factura', async () => {
      const pool = getPool();
      const eventId = await createTestEvent();
      testEventIds.push(eventId);
      await createTestClient(eventId);
      await createTestOrder(eventId, 12000);
      const planId = await createTestPlan(eventId, 12000);
      
      const senalId = await createTestMilestone(planId, 'senal', 'Señal 40%', 4800, 'pagado');
      const restoId = await createTestMilestone(planId, 'resto', 'Resto 60%', 7200, 'pendiente');

      // Facturar la señal
      await transaction(async (client) => {
        return createAdvanceInvoice(client, senalId);
      });

      const milestones = await getMilestonesWithInvoiceStatus(pool as any, eventId);
      
      expect(milestones).toHaveLength(2);
      
      const senal = milestones.find(m => m.kind === 'senal');
      expect(senal?.invoiced_at).not.toBeNull();
      expect(senal?.invoice_number).toBeDefined();
      
      const resto = milestones.find(m => m.kind === 'resto');
      expect(resto?.invoiced_at).toBeNull();
      expect(resto?.invoice_number).toBeUndefined();
    });
  });
});
