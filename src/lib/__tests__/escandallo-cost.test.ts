/**
 * EventFlow — Tests del cálculo de coste del escandallo (teórico↔real)  ·  FR-C03/S06
 * Fija el cálculo PURO antes de confiar en él.
 */
import { describe, it, expect } from 'vitest';
import { lineCost } from '../escandallo';

describe('lineCost — coste estimado / real / desviación', () => {
  it('estimado = qty_teórica × coste_unitario', () => {
    // Solomillo: 24000 g × 0,04 €/g = 960 €
    const c = lineCost(24000, null, 0.04);
    expect(c.estimado).toBe(960);
    expect(c.real).toBeNull();          // sin consumo registrado
    expect(c.desviacion_coste).toBe(0); // real = teórico por defecto
    expect(c.desviacion_qty).toBe(0);
  });

  it('real por encima del teórico → desviación positiva', () => {
    // Se consumieron 25000 g en vez de 24000 g
    const c = lineCost(24000, 25000, 0.04);
    expect(c.estimado).toBe(960);
    expect(c.real).toBe(1000);            // 25000 × 0,04
    expect(c.desviacion_coste).toBe(40);  // 1000 − 960
    expect(c.desviacion_qty).toBe(1000);  // 25000 − 24000
  });

  it('real por debajo del teórico → desviación negativa (ahorro)', () => {
    const c = lineCost(24000, 22000, 0.04);
    expect(c.real).toBe(880);
    expect(c.desviacion_coste).toBe(-80);
    expect(c.desviacion_qty).toBe(-2000);
  });

  it('coste unitario 0 → todo 0 (no rompe)', () => {
    const c = lineCost(1000, 1000, 0);
    expect(c.estimado).toBe(0);
    expect(c.real).toBe(0);
    expect(c.desviacion_coste).toBe(0);
  });

  it('redondea a céntimo (sin ruido de coma flotante)', () => {
    const c = lineCost(240, null, 0.001); // 0,24 €
    expect(c.estimado).toBe(0.24);
  });
});
