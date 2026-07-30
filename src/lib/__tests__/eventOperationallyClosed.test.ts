/**
 * Tests para el handler event.operationally_closed (WP-24)
 * 
 * Verifica que:
 * 1. El handler calcula correctamente el cierre económico
 * 2. La tabla event_financial_closures se crea/actualiza correctamente
 * 3. El cierre es idempotente
 * 4. El margen real se calcula correctamente
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleEventOperationallyClosed } from '@/domain/handlers/eventOperationallyClosed';

// Mock de la conexión a BD
const mockQuery = vi.fn();
const mockClient = {
  query: mockQuery,
  release: vi.fn(),
};
const mockPool = {
  connect: vi.fn().mockResolvedValue(mockClient),
};

vi.mock('@/lib/db', () => ({
  getPool: () => mockPool,
}));

describe('handleEventOperationallyClosed', () => {
  const testEventId = 'test-event-123';
  const testPayload = {
    event_id: testEventId,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock por defecto para transacciones
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
        return { rows: [] };
      }
      return { rows: [] };
    });
  });

  it('debería calcular el cierre económico correctamente', async () => {
    // Mock: evento existe
    mockQuery.mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes('SELECT id, guest_count, total_pvp')) {
        return {
          rows: [{
            id: testEventId,
            guest_count: 100,
            total_pvp: 5000,
            bar_price: 10,
            bar_hours: 3,
          }],
        };
      }
      // Mock: costes de comida
      if (sql.includes('event_shopping_items')) {
        return {
          rows: [{
            planned_food_cost: 1500,
            real_food_cost: 1600,
          }],
        };
      }
      // Mock: costes de personal
      if (sql.includes('worker_event_pay')) {
        return {
          rows: [{
            planned_staff_cost: 800,
            real_staff_cost: 750,
          }],
        };
      }
      // Mock: cierre existente
      if (sql.includes('SELECT id, frozen FROM event_financial_closures')) {
        return { rows: [] };
      }
      // Mock: inserción
      if (sql.includes('INSERT INTO event_financial_closures')) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    const event = {
      id: 1,
      event_type: 'event.operationally_closed',
      aggregate_type: 'event',
      aggregate_id: testEventId,
      payload: testPayload,
      created_at: new Date(),
      processed_at: null,
      attempts: 0,
      last_error: null,
    };

    await handleEventOperationallyClosed(event as any);

    // Verificar que se insertó el cierre económico
    const insertCall = mockQuery.mock.calls.find(
      (call: any) => call[0]?.includes('INSERT INTO event_financial_closures')
    );
    expect(insertCall).toBeTruthy();
  });

  it('debería ser idempotente (no sobreescribir cierre congelado)', async () => {
    // Mock: cierre ya existe y está congelado
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id, frozen FROM event_financial_closures')) {
        return {
          rows: [{
            id: 'existing-closure',
            frozen: true,
          }],
        };
      }
      return { rows: [] };
    });

    const event = {
      id: 1,
      event_type: 'event.operationally_closed',
      aggregate_type: 'event',
      aggregate_id: testEventId,
      payload: testPayload,
      created_at: new Date(),
      processed_at: null,
      attempts: 0,
      last_error: null,
    };

    await handleEventOperationallyClosed(event as any);

    // Verificar que se hizo ROLLBACK (no se insertó)
    const rollbackCall = mockQuery.mock.calls.find(
      (call: any) => call[0] === 'ROLLBACK'
    );
    expect(rollbackCall).toBeTruthy();
  });

  it('debería calcular margen real correctamente', async () => {
    // Mock: evento con datos específicos
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id, guest_count, total_pvp')) {
        return {
          rows: [{
            id: testEventId,
            guest_count: 50,
            total_pvp: 2500,
            bar_price: 0,
            bar_hours: 0,
          }],
        };
      }
      if (sql.includes('event_shopping_items')) {
        return {
          rows: [{
            planned_food_cost: 500,
            real_food_cost: 600,
          }],
        };
      }
      if (sql.includes('worker_event_pay')) {
        return {
          rows: [{
            planned_staff_cost: 300,
            real_staff_cost: 350,
          }],
        };
      }
      if (sql.includes('SELECT id, frozen FROM event_financial_closures')) {
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO event_financial_closures')) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    const event = {
      id: 1,
      event_type: 'event.operationally_closed',
      aggregate_type: 'event',
      aggregate_id: testEventId,
      payload: testPayload,
      created_at: new Date(),
      processed_at: null,
      attempts: 0,
      last_error: null,
    };

    await handleEventOperationallyClosed(event as any);

    // Verificar los parámetros de inserción
    const insertCall = mockQuery.mock.calls.find(
      (call: any) => call[0]?.includes('INSERT INTO event_financial_closures')
    );
    expect(insertCall).toBeTruthy();

    // Los parámetros deberían incluir el margen real calculado
    // margen = (2500 - 600 - 350) / 2500 * 100 = 62%
    const params = insertCall[1];
    expect(params).toContain(62); // real_margin_pct
  });
});
