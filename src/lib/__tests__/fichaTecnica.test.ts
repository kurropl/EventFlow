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

  it('precio mínimo = coste unitario × multiplicador configurable (precisión completa: 10.224×3, no 10.22×3)', () => {
    const t = computeFichaTotales(lineas, 20, 232, 3, null);
    expect(t.precioMinimo).toBe(30.67);
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

describe('computeFichaTotales — precisión (caso real: PASTA_ESPEJO.xlsx)', () => {
  // Una línea de cantidad muy pequeña (0.002 kg de yema) no debe perderse
  // al redondear el peso total ANTES de dividir por el peso/ración — si se
  // redondea primero, 2.142 kg se convierte en 2.14 kg y las raciones caen
  // de 214.2 a 214 exactas, con un coste unitario ligeramente distinto.
  const lineas = [
    { quantity: 0.2, unitCost: 1.03 },   // harina
    { quantity: 0.5, unitCost: 2.6 },    // az. glace
    { quantity: 0.04, unitCost: 0.22 },  // sal
    { quantity: 1.4, unitCost: 9.3 },    // mantequilla
    { quantity: 0.002, unitCost: 6.55 }, // yema — la línea pequeña que se perdía
  ];

  it('peso total conserva los 3 decimales (2.142, no 2.14 truncado a mitad de cálculo)', () => {
    const t = computeFichaTotales(lineas, 20, 0.01, 3, 1);
    expect(t.pesoTotal).toBe(2.14); // redondeado SOLO para mostrar
    expect(t.raciones).toBe(214.2); // pero las raciones usan el valor sin redondear
  });

  it('coste materia prima incluye la línea pequeña completa', () => {
    const t = computeFichaTotales(lineas, 20, 0.01, 3, 1);
    expect(t.costeMateriaPrima).toBe(14.55); // 14.5479 redondeado, no 14.53 (sin la yema)
  });

  it('coincide con los valores cacheados del Excel real', () => {
    const t = computeFichaTotales(lineas, 20, 0.01, 3, 1);
    expect(t.costeTotal).toBe(17.46);      // Excel: 17.45748
    expect(t.costeUnitario).toBe(0.08);    // Excel: 0.0815008...
    expect(t.beneficioTotal).toBe(196.74); // Excel: 196.74252
  });
});
