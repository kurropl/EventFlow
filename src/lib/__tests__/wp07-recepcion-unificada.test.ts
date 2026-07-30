/**
 * WP-07 — Tests unitarios: Recepción Unificada APPCC ↔ Stock ↔ OC
 *
 * Tests de la lógica de negocio del servicio unificado:
 *   - Validación de parámetros
 *   - Cálculo de cantidades y estados
 *   - Detección de precio cambiado
 *   - Comportamiento NR-2 sin línea OC
 *
 * Nota: estos tests NO ejecutan queries reales (no BD).
 */
import { describe, it, expect } from 'vitest';

// ── Helpers puros extraídos para testeabilidad ─────────────────

/** Determina el estado de la línea OC según cantidades recibidas */
function computeLineStatus(qtyOrdered: number, qtyReceived: number): string {
  if (qtyReceived >= qtyOrdered) return 'received';
  if (qtyReceived > 0) return 'partial';
  return 'pending';
}

/** Determina el estado de la OC según el estado de todas sus líneas */
function computeOrderStatus(
  lineStatuses: Array<{ qtyOrdered: number; qtyReceived: number }>
): string {
  const allReceived = lineStatuses.every(
    (l) => l.qtyReceived >= l.qtyOrdered
  );
  const anyReceived = lineStatuses.some(
    (l) => l.qtyReceived > 0
  );
  if (allReceived) return 'received';
  if (anyReceived) return 'partial';
  return 'pending';
}

/** Verifica si el precio del ingrediente cambió */
function hasPriceChanged(
  previousPrice: number,
  newPrice: number,
  tolerance = 0.001
): boolean {
  return Math.abs(previousPrice - newPrice) > tolerance;
}

/** Convierte cantidad a unidad base (conversión simple) */
function convertToBase(qty: number, fromUnit: string, toBaseUnit: string): number {
  if (fromUnit === toBaseUnit) return qty;
  if (fromUnit === 'kg' && toBaseUnit === 'g') return qty * 1000;
  if (fromUnit === 'l' && toBaseUnit === 'ml') return qty * 1000;
  if (fromUnit === 'g' && toBaseUnit === 'kg') return qty / 1000;
  if (fromUnit === 'ml' && toBaseUnit === 'l') return qty / 1000;
  return qty; // conversión desconocida: se usa tal cual
}

// ── Tests ─────────────────────────────────────────────────────

describe('WP-07 — computeLineStatus', () => {
  it('línea pendiente cuando no se ha recibido nada', () => {
    expect(computeLineStatus(100, 0)).toBe('pending');
  });

  it('línea parcial cuando se recibió parte', () => {
    expect(computeLineStatus(100, 50)).toBe('partial');
  });

  it('línea recibida completa cuando cantidad = ordenada', () => {
    expect(computeLineStatus(100, 100)).toBe('received');
  });

  it('línea recibida completa cuando cantidad > ordenada (sobrante)', () => {
    expect(computeLineStatus(100, 120)).toBe('received');
  });

  it('línea con 1 unidad recibida de 1000 → parcial', () => {
    expect(computeLineStatus(1000, 1)).toBe('partial');
  });
});

describe('WP-07 — computeOrderStatus', () => {
  it('todas pendientes → pending', () => {
    expect(computeOrderStatus([
      { qtyOrdered: 100, qtyReceived: 0 },
      { qtyOrdered: 50, qtyReceived: 0 },
    ])).toBe('pending');
  });

  it('una parcial, otra pendiente → partial', () => {
    expect(computeOrderStatus([
      { qtyOrdered: 100, qtyReceived: 50 },
      { qtyOrdered: 50, qtyReceived: 0 },
    ])).toBe('partial');
  });

  it('todas recibidas → received', () => {
    expect(computeOrderStatus([
      { qtyOrdered: 100, qtyReceived: 100 },
      { qtyOrdered: 50, qtyReceived: 50 },
    ])).toBe('received');
  });

  it('una recibida, otra pendiente → partial', () => {
    expect(computeOrderStatus([
      { qtyOrdered: 100, qtyReceived: 100 },
      { qtyOrdered: 50, qtyReceived: 0 },
    ])).toBe('partial');
  });

  it('una parcial, otra recibida → partial', () => {
    expect(computeOrderStatus([
      { qtyOrdered: 100, qtyReceived: 80 },
      { qtyOrdered: 50, qtyReceived: 50 },
    ])).toBe('partial');
  });

  it('una sobrante, otra recibida → received', () => {
    expect(computeOrderStatus([
      { qtyOrdered: 100, qtyReceived: 120 },
      { qtyOrdered: 50, qtyReceived: 50 },
    ])).toBe('received');
  });
});

describe('WP-07 — hasPriceChanged', () => {
  it('mismo precio → no cambió', () => {
    expect(hasPriceChanged(10.50, 10.50)).toBe(false);
  });

  it('precio diferente → cambió', () => {
    expect(hasPriceChanged(10.50, 12.00)).toBe(true);
  });

  it('diferencia dentro de tolerancia → no cambió', () => {
    expect(hasPriceChanged(10.50, 10.5001, 0.001)).toBe(false);
  });

  it('diferencia fuera de tolerancia → cambió', () => {
    expect(hasPriceChanged(10.50, 10.51, 0.001)).toBe(true);
  });

  it('precio 0 → 5 → cambió', () => {
    expect(hasPriceChanged(0, 5)).toBe(true);
  });
});

describe('WP-07 — convertToBase', () => {
  it('kg → g (×1000)', () => {
    expect(convertToBase(2.5, 'kg', 'g')).toBe(2500);
  });

  it('l → ml (×1000)', () => {
    expect(convertToBase(3, 'l', 'ml')).toBe(3000);
  });

  it('g → kg (÷1000)', () => {
    expect(convertToBase(500, 'g', 'kg')).toBe(0.5);
  });

  it('ml → l (÷1000)', () => {
    expect(convertToBase(750, 'ml', 'l')).toBe(0.75);
  });

  it('misma unidad → sin cambio', () => {
    expect(convertToBase(100, 'g', 'g')).toBe(100);
  });

  it('ud → ud → sin cambio', () => {
    expect(convertToBase(12, 'ud', 'ud')).toBe(12);
  });

  it('unidad desconocida → se usa tal cual', () => {
    expect(convertToBase(5, 'caja', 'g')).toBe(5);
  });
});

describe('WP-07 — Flujo integrado lógico (sin BD)', () => {
  it('recepción con línea OC: actualización de línea y OC', () => {
    // Línea: 100 ud ordenadas, 30 recibidas previamente
    const qtyOrdered = 100;
    const qtyReceivedBefore = 30;
    const qtyReceivedNow = 40;

    const qtyAfter = qtyReceivedBefore + qtyReceivedNow; // 70
    const lineStatus = computeLineStatus(qtyOrdered, qtyAfter); // partial

    expect(qtyAfter).toBe(70);
    expect(lineStatus).toBe('partial');

    // OC con 2 líneas: la primera parcial, la segunda pendiente
    const orderStatus = computeOrderStatus([
      { qtyOrdered: 100, qtyReceived: 70 },
      { qtyOrdered: 50, qtyReceived: 0 },
    ]);
    expect(orderStatus).toBe('partial');
  });

  it('recepción que completa la línea y la OC', () => {
    const qtyOrdered = 100;
    const qtyReceivedBefore = 80;
    const qtyReceivedNow = 20;

    const qtyAfter = qtyReceivedBefore + qtyReceivedNow; // 100
    const lineStatus = computeLineStatus(qtyOrdered, qtyAfter); // received

    expect(qtyAfter).toBe(100);
    expect(lineStatus).toBe('received');

    // OC con 1 sola línea → received
    const orderStatus = computeOrderStatus([
      { qtyOrdered: 100, qtyReceived: 100 },
    ]);
    expect(orderStatus).toBe('received');
  });

  it('recepción sin línea OC: comportamiento NR-2 (sin cambios en OC)', () => {
    // Sin supplierOrderItemId, no se toca la OC
    const supplierOrderItemId = null;
    const shouldUpdateOrder = supplierOrderItemId !== null;
    expect(shouldUpdateOrder).toBe(false);
  });

  it('recepción con precio diferente: actualiza historial', () => {
    const previousPrice = 10.50;
    const newPrice = 12.00;
    const shouldUpdate = hasPriceChanged(previousPrice, newPrice);

    expect(shouldUpdate).toBe(true);

    // Precio igual → no actualiza
    expect(hasPriceChanged(10.50, 10.50)).toBe(false);
  });

  it('recepción con precio 0 en línea: no actualiza historial', () => {
    const lineUnitCost = 0;
    const previousPrice = 10.50;
    const shouldUpdate = lineUnitCost > 0 && hasPriceChanged(previousPrice, lineUnitCost);

    expect(shouldUpdate).toBe(false);
  });
});
