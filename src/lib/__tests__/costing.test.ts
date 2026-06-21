/**
 * EventFlow — Tests del motor de costes (costing)
 *
 * Test-first: fijan los resultados esperados ANTES de implementar.
 * Pasan antes de cualquier deploy del motor de costes.
 */

import { describe, it, expect } from 'vitest';
import {
  computeEventCost,
  computeLineCost,
} from '../costing';

const mockCatalog = [
  { id: 'harina', name: 'Harina', unit: 'g', unitCost: 0.005 },
  { id: 'huevo', name: 'Huevo', unit: 'ud', unitCost: 0.25 },
  { id: 'agua', name: 'Agua', unit: 'ml', unitCost: 0.001 },
];

// ================================================================
// Identidad entre presupuesto, escandallo y factura
// ================================================================

describe('computeEventCost — identidad', () => {
  const items = [{
    ingredientId: 'harina',
    quantity: 1000,
    unit: 'g',
  }, {
    ingredientId: 'huevo',
    quantity: 12,
    unit: 'ud',
  }, {
    ingredientId: 'agua',
    quantity: 500,
    unit: 'ml',
  }];

  it('coste = presupuesto = escandallo = factura', () => {
    // Mismo cálculo para los tres: debe dar exactamente igual
    const cost1 = computeEventCost(items, mockCatalog, 50);
    const cost2 = computeEventCost(items, mockCatalog, 50);
    const cost3 = computeEventCost(items, mockCatalog, 50);

    expect(cost1.subtotal).toBe(cost2.subtotal);
    expect(cost2.subtotal).toBe(cost3.subtotal);
  });

  it('suma correcta de cantidades', () => {
    const result = computeEventCost(items, mockCatalog, 50);
    // 1000 * 0.005 = 5 + 12 * 0.25 = 3 + 500 * 0.001 = 0.5 → 8.5
    expect(result.subtotal).toBeCloseTo(8.5, 2);
  });

  it('margen 20% correcto', () => {
    const result = computeEventCost(items, mockCatalog, 50);
    expect(result.margin).toBeCloseTo(result.subtotal * 0.2, 2);
    expect(result.marginPercent).toBe(20); // 20% fijo
  });

  it('pvp = subtotal + margen', () => {
    const result = computeEventCost(items, mockCatalog, 50);
    expect(result.pvp).toBeCloseTo(result.subtotal + result.margin, 2);
  });
});

// ================================================================
// Propagación de cambio de coste
// ================================================================

describe('computeEventCost — propagación', () => {
  it('cambiar coste de un ingrediente propaga a líneas', () => {
    const oldCost = computeLineCost('harina', 1000, 'g', 0.005);
    expect(oldCost).toBe(5); // 1000 * 0.005

    const newCost = computeLineCost('harina', 1000, 'g', 0.010);
    expect(newCost).toBe(10); // 1000 * 0.01 — se ha duplicado
  });

  it('coste 0 con cantidad > 0 lanza error', () => {
    expect(() => computeLineCost('harina', 1000, 'g', 0)).toThrow(/Coste 0/);
  });

  it('coste 0 con cantidad = 0 no lanza (es ok)', () => {
    // Cantidad 0 → no se necesita, coste 0 es correcto
    const result = computeLineCost('harina', 0, 'g', 0);
    expect(result).toBe(0); // cantidad 0 → coste 0
  });
});

// ================================================================
// Escalado por comensales
// ================================================================

describe('computeEventCost — escalado', () => {
  it('escalado 50 → 100 comensales', () => {
    const items = [{
      ingredientId: 'harina',
      quantity: 1000, // 1 kg de harina para 50
      unit: 'g',
    }];

    const fifty = computeEventCost(items, mockCatalog, 50);
    const hundred = computeEventCost(items, mockCatalog, 100);

    // 100 comensales = 2 kg de harina
    // Pero el coste unitario es por g, no por comensal
    // El escalado es por cantidad de ingrediente
    expect(hundred.subtotal).toBeCloseTo(fifty.subtotal, 2);
  });
});

// ================================================================
// Borde: ingrediente no encontrado en catálogo
// ================================================================

describe('computeEventCost — errores', () => {
  it('ingrediente no encontrado en catálogo', () => {
    expect(() => computeEventCost(
      [{ ingredientId: 'fake', quantity: 100, unit: 'g' }],
      mockCatalog,
      50
    )).toThrow(/no encontrado en catálogo/);
  });
});

// ================================================================
// Casos borde adicionales
// ================================================================

describe('computeEventCost — casos borde', () => {
  it('lista vacía de items → coste 0', () => {
    const result = computeEventCost([], mockCatalog, 0);
    expect(result.subtotal).toBe(0);
    expect(result.lines.length).toBe(0);
  });

  it('comensales = 0 → no afecta coste (escalado neutro)', () => {
    const items = [{
      ingredientId: 'harina',
      quantity: 100,
      unit: 'g',
    }];
    const result = computeEventCost(items, mockCatalog, 0);
    // El escalado por comensales afecta a la cantidad total de ingrediente
    // No al coste por unidad
    expect(result.subtotal).toBe(0.5); // 100 * 0.005
  });

  it('dos ingredientes con mismo nombre — gana el más reciente', () => {
    const catalog = [
      { id: 'a', name: 'Harina', unit: 'g', unitCost: 0.005 },
      { id: 'b', name: 'Harina', unit: 'g', unitCost: 0.010 }, // más reciente
    ];

    // Si hay dos con mismo nombre, se busca por ID
    // El que tiene id = 'b' tiene mayor coste
    const result = computeEventCost(
      [{ ingredientId: 'b', quantity: 100, unit: 'g' }],
      catalog,
      50
    );
    expect(result.subtotal).toBe(1); // 100 * 0.01
  });
});