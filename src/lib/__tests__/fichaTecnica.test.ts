/**
 * EventFlow — Tests de la ficha técnica (coste/precio de receta)
 * Fija el cálculo PURO antes de confiar en él.
 */
import { describe, it, expect } from 'vitest';
import { computeFichaTotales } from '../fichaTecnica';

describe('computeFichaTotales', () => {
  const lineas = [
    { quantity: 200, unitCost: 0.02 }, // solomillo: 200g × 0,02€/g = 4€
    { quantity: 30, unitCost: 0.15 },  // foie: 30g × 0,15€/g = 4,5€
    { quantity: 2, unitCost: 0.01 },   // sal: 2g × 0,01€/g = 0,02€
  ];

  it('peso total = suma de cantidades', () => {
    const t = computeFichaTotales(lineas, 20, 232, 3, null);
    expect(t.pesoTotal).toBe(232);
  });

  it('raciones = peso total ÷ peso por ración', () => {
    const t = computeFichaTotales(lineas, 20, 232, 3, null);
    expect(t.raciones).toBe(1);
  });

  it('coste materia prima = Σ (cantidad × coste unitario)', () => {
    const t = computeFichaTotales(lineas, 20, 232, 3, null);
    expect(t.costeMateriaPrima).toBe(8.52);
  });

  it('coste total aplica la merma agregada de la receta (no por ingrediente)', () => {
    const t = computeFichaTotales(lineas, 20, 232, 3, null);
    // 8.52 * 1.2 = 10.224 -> redondeo a 10.22
    expect(t.costeTotal).toBe(10.22);
  });

  it('coste unitario = coste total ÷ raciones', () => {
    const t = computeFichaTotales(lineas, 20, 232, 3, null);
    expect(t.costeUnitario).toBe(10.22);
  });

  it('precio mínimo = coste unitario × multiplicador configurable', () => {
    const t = computeFichaTotales(lineas, 20, 232, 3, null);
    expect(t.precioMinimo).toBe(30.66);
  });

  it('beneficio unitario/total solo se calculan si hay precio de venta', () => {
    const sinPvp = computeFichaTotales(lineas, 20, 232, 3, null);
    expect(sinPvp.beneficioUnitario).toBeNull();
    expect(sinPvp.beneficioTotal).toBeNull();

    const conPvp = computeFichaTotales(lineas, 20, 232, 3, 35);
    expect(conPvp.beneficioUnitario).toBe(24.78); // 35 - 10.22
    expect(conPvp.beneficioTotal).toBe(24.78);     // (35*1) - 10.22
  });

  it('sin peso por ración → raciones/coste unitario/precio mínimo son null, no #DIV/0!', () => {
    const t = computeFichaTotales(lineas, 20, null, 3, null);
    expect(t.raciones).toBeNull();
    expect(t.costeUnitario).toBeNull();
    expect(t.precioMinimo).toBeNull();
  });

  it('sin ingredientes → todo a 0, no crashea', () => {
    const t = computeFichaTotales([], 20, 100, 3, null);
    expect(t.pesoTotal).toBe(0);
    expect(t.costeMateriaPrima).toBe(0);
    expect(t.costeTotal).toBe(0);
    expect(t.raciones).toBe(0); // peso 0 / racion 100 = 0, no null (racion sí es > 0)
  });
});
