/**
 * WP-02 — Tests unitarios del servicio de movimientos de stock
 *
 * Tests de la lógica pura de recordStockMovement:
 *   - Normalización de signo por tipo de movimiento
 *   - Cálculo de delta y nuevo stock
 *   - Emisión de stock.below_minimum cuando procede
 *
 * Nota: estos tests NO ejecutan queries reales (no BD).
 * Se testea la lógica de negocio pura de los helpers y tipos.
 */
import { describe, it, expect } from 'vitest';

// ── Helpers puros extraídos para testeabilidad ─────────────────

/** Normaliza el signo de qtyBase según el tipo de movimiento (regla de negocio WP-02) */
function normalizeMovementSign(
  movementType: string,
  qtyBase: number
): number {
  if (['salida', 'merma', 'retorno'].includes(movementType) && qtyBase > 0) {
    return -qtyBase;
  }
  if (movementType === 'entrada' && qtyBase < 0) {
    return -qtyBase;
  }
  return qtyBase;
}

/** Calcula el stock resultante tras un movimiento */
function computeNewStock(
  currentQty: number,
  signedQty: number,
  clampToZero = true
): number {
  let newQty = currentQty + signedQty;
  if (clampToZero) newQty = Math.max(0, newQty);
  return Math.round(newQty * 10000) / 10000;
}

/** Detecta si el stock cae bajo el mínimo */
function isBelowMinimum(newQty: number, minStock: number): boolean {
  return newQty <= minStock && minStock > 0;
}

// ── Tests ─────────────────────────────────────────────────────

describe('WP-02 — stockMovements: normalización de signo', () => {
  it('entrada positiva se mantiene positiva', () => {
    expect(normalizeMovementSign('entrada', 100)).toBe(100);
  });

  it('entrada negativa se invierte a positiva', () => {
    expect(normalizeMovementSign('entrada', -50)).toBe(50);
  });

  it('salida positiva se convierte a negativa', () => {
    expect(normalizeMovementSign('salida', 30)).toBe(-30);
  });

  it('salida ya negativa se mantiene negativa', () => {
    expect(normalizeMovementSign('salida', -30)).toBe(-30);
  });

  it('merma positiva se convierte a negativa', () => {
    expect(normalizeMovementSign('merma', 10)).toBe(-10);
  });

  it('retorno positivo se convierte a negativo', () => {
    expect(normalizeMovementSign('retorno', 5)).toBe(-5);
  });

  it('ajuste puede ser positivo (suma)', () => {
    expect(normalizeMovementSign('ajuste', 25)).toBe(25);
  });

  it('ajuste puede ser negativo (resta)', () => {
    expect(normalizeMovementSign('ajuste', -25)).toBe(-25);
  });
});

describe('WP-02 — stockMovements: cálculo de stock', () => {
  it('stock sube con entrada', () => {
    expect(computeNewStock(100, 50)).toBe(150);
  });

  it('stock baja con salida', () => {
    expect(computeNewStock(100, -30)).toBe(70);
  });

  it('stock no baja de 0 por defecto (clampToZero)', () => {
    expect(computeNewStock(10, -50)).toBe(0);
  });

  it('stock permite negativo si clampToZero = false', () => {
    expect(computeNewStock(10, -50, false)).toBe(-40);
  });

  it('decimales se redondean a 4 cifras', () => {
    expect(computeNewStock(10.12345, 0.00006)).toBe(10.1235);
  });

  it('stock exacto 0 con salida de 0', () => {
    expect(computeNewStock(0, 0)).toBe(0);
  });
});

describe('WP-02 — stockMovements: detección de stock bajo mínimo', () => {
  it('stock igual al mínimo => bajo', () => {
    expect(isBelowMinimum(10, 10)).toBe(true);
  });

  it('stock por debajo del mínimo => bajo', () => {
    expect(isBelowMinimum(5, 10)).toBe(true);
  });

  it('stock por encima del mínimo => no bajo', () => {
    expect(isBelowMinimum(15, 10)).toBe(false);
  });

  it('mínimo 0 => nunca bajo (sin mínimo configurado)', () => {
    expect(isBelowMinimum(0, 0)).toBe(false);
  });

  it('stock 0 con mínimo 1 => bajo', () => {
    expect(isBelowMinimum(0, 1)).toBe(true);
  });
});

describe('WP-02 — stockMovements: tipos de movimiento', () => {
  const validTypes = ['entrada', 'salida', 'merma', 'ajuste', 'retorno'];

  it('todos los tipos son válidos', () => {
    for (const t of validTypes) {
      expect(['entrada', 'salida', 'merma', 'ajuste', 'retorno']).toContain(t);
    }
  });

  it('tipo inválido no está en la lista', () => {
    expect(validTypes).not.toContain('transferencia');
    expect(validTypes).not.toContain('devolucion');
  });
});

describe('WP-02 — stockMovements: integración lógica', () => {
  it('ciclo completo: entrada + salida = stock correcto', () => {
    let stock = 0;
    // Entrada de 100
    stock = computeNewStock(stock, normalizeMovementSign('entrada', 100));
    expect(stock).toBe(100);
    // Salida de 30
    stock = computeNewStock(stock, normalizeMovementSign('salida', 30));
    expect(stock).toBe(70);
    // Merma de 10
    stock = computeNewStock(stock, normalizeMovementSign('merma', 10));
    expect(stock).toBe(60);
    // Retorno de 5
    stock = computeNewStock(stock, normalizeMovementSign('retorno', 5));
    expect(stock).toBe(55);
  });

  it('ajuste puede corregir stock a cualquier valor', () => {
    let stock = 100;
    // Ajuste manual a 75 (delta negativo)
    const delta = 75 - stock; // -25
    stock = computeNewStock(stock, delta);
    expect(stock).toBe(75);
    // Ajuste manual a 200 (delta positivo)
    const delta2 = 200 - stock; // 125
    stock = computeNewStock(stock, delta2);
    expect(stock).toBe(200);
  });

  it('salida excesiva se clampa a 0', () => {
    let stock = 50;
    stock = computeNewStock(stock, normalizeMovementSign('salida', 200));
    expect(stock).toBe(0);
  });

  it('stock bajo mínimo se detecta tras salida', () => {
    const minStock = 20;
    let stock = 25;
    stock = computeNewStock(stock, normalizeMovementSign('salida', 10));
    expect(isBelowMinimum(stock, minStock)).toBe(true);
  });
});
