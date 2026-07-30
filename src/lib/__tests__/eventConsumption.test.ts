/**
 * EventFlow — WP-09: Tests de Consumo por Evento
 * 
 * Tests para la lógica de:
 * 1. Registro de salidas al marcar items en Carga
 * 2. Registro de retornos
 * 3. Cálculo de merma al cerrar vuelta
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de las dependencias
vi.mock('@/lib/db', () => ({
  getPool: vi.fn(),
}));

vi.mock('@/lib/domain/stockMovements', () => ({
  recordStockMovement: vi.fn(),
}));

// Importar después de los mocks
import { recordConsumption, recordReturn, closeReturn, getConsumptionSummary } from '@/lib/domain/eventConsumption';
import { getPool } from '@/lib/db';
import { recordStockMovement } from '@/lib/domain/stockMovements';

describe('WP-09: Consumo por Evento', () => {
  let mockClient: any;
  let mockPool: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      query: vi.fn(),
    };

    (getPool as any).mockReturnValue(mockPool);
    (recordStockMovement as any).mockResolvedValue({
      movementId: 123,
      ingredientId: 'ing-1',
      previousQty: 100,
      newQty: 90,
      unit: 'g',
      baseUnit: 'g',
      belowMinimum: false,
    });
  });

  describe('recordConsumption', () => {
    it('debería registrar un movimiento de salida al marcar item', async () => {
      // Mock para encontrar lote
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1, qty_base_remaining: 50 }] }) // Buscar lote FEFO
        .mockResolvedValueOnce({ rows: [] }); // UPDATE event_shopping_items

      const result = await recordConsumption({
        eventId: 'evt-1',
        shoppingItemId: 'shop-1',
        ingredientId: 'ing-1',
        ingredientName: 'Harina',
        quantityBase: 10,
      });

      expect(recordStockMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          ingredientId: 'ing-1',
          movementType: 'salida',
          qtyBase: 10,
          eventId: 'evt-1',
        }),
        mockClient
      );
    });
  });

  describe('recordReturn', () => {
    it('debería registrar un retorno y crear movimiento inverso', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'ret-1' }] }) // INSERT retorno
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await recordReturn({
        eventId: 'evt-1',
        ingredientId: 'ing-1',
        ingredientName: 'Harina',
        quantityReturned: 5,
      });

      expect(recordStockMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          ingredientId: 'ing-1',
          movementType: 'retorno',
          qtyBase: 5,
          eventId: 'evt-1',
        }),
        mockClient
      );
    });
  });

  describe('closeReturn', () => {
    it('debería calcular merma correctamente', async () => {
      // Mock para salidas y retornos
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ // Salidas
          rows: [
            { ingredient_id: 'ing-1', total_consumed: 10 },
            { ingredient_id: 'ing-2', total_consumed: 5 },
          ],
        })
        .mockResolvedValueOnce({ // Retornos
          rows: [
            { ingredient_id: 'ing-1', total_returned: 3 },
          ],
        })
        .mockResolvedValueOnce({ // Ingrediente 1
          rows: [{ id: 'ing-1', name: 'Harina', unit: 'g' }],
        })
        .mockResolvedValueOnce({ rows: [] }) // Merma ing 1
        .mockResolvedValueOnce({ // Ingrediente 2
          rows: [{ id: 'ing-2', name: 'Azúcar', unit: 'g' }],
        })
        .mockResolvedValueOnce({ rows: [] }) // Merma ing 2
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await closeReturn({
        eventId: 'evt-1',
      });

      expect(result.items).toHaveLength(2);
      expect(result.items[0].waste).toBe(7); // 10 - 3
      expect(result.items[1].waste).toBe(5); // 5 - 0
      expect(result.totalWaste).toBe(12);
    });
  });

  describe('getConsumptionSummary', () => {
    it('debería retornar resumen de consumo', async () => {
      mockPool.query
        .mockResolvedValueOnce({ // Salidas
          rows: [
            { ingredient_id: 'ing-1', total_consumed: 10 },
          ],
        })
        .mockResolvedValueOnce({ // Retornos
          rows: [
            { ingredient_id: 'ing-1', total_returned: 2 },
          ],
        })
        .mockResolvedValueOnce({ // Ingrediente
          rows: [{ id: 'ing-1', name: 'Harina', unit: 'g' }],
        });

      const result = await getConsumptionSummary('evt-1');

      expect(result.totalConsumed).toBe(10);
      expect(result.totalReturned).toBe(2);
      expect(result.totalWaste).toBe(8);
    });
  });
});
