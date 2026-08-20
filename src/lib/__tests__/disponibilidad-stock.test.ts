/**
 * EventFlow — Tests de disponibilidad de stock por escandallo
 * (función pura: necesario vs stock vs comprometido con mérgen de merma)
 */

import { describe, it, expect } from 'vitest';
import { calcularDisponibilidad } from '@/lib/domain/disponibilidadStock';

describe('calcularDisponibilidad', () => {
  it('aplica merma por defecto (25 %) y calcula faltante desde brutos', () => {
    // merma default = 0.25 → brutos = 100 / 0.75 = 133.333…
    const res = calcularDisponibilidad({
      necesidad: 100, // g
      stock: 80,
      comprometido: 0,
    });
    // brutos = 133.33, stock dispon = 80 → faltante = 53.33
    expect(res.faltante).toBeCloseTo(53.33, 1);
    expect(res.disponible).toBe(80);
  });

  it('brutos = necesidad / (1 − merma) con merma personalizado', () => {
    // merma 10% → brutos = 100 / 0.9 = 111.11
    const res = calcularDisponibilidad({
      necesidad: 100, mermaPct: 0.10,
      stock: 150, comprometido: 60,
    });
    expect(res.brutos).toBeCloseTo(111.11, 1);
    expect(res.disponible).toBe(90); // 150 - 60
    expect(res.faltante).toBeCloseTo(21.11, 1); // 111.11 - 90
  });

  it('devuelve faltante 0 si hay stock suficiente para cubrir brutos', () => {
    const res = calcularDisponibilidad({
      necesidad: 100,
      stock: 200,
      comprometido: 0,
    });
    // brutos = 133.33, stock = 200 → disponible = 200 → faltante = 0
    expect(res.faltante).toBe(0);
  });

  it('conSeguridad explícita se respeta si es mayor que brutos', () => {
    // caller pasa seguridad = 105 → como brutos = 133.33 → se usa max: 133.33
    const res = calcularDisponibilidad({
      necesidad: 100, conSeguridad: 105,
      stock: 200, comprometido: 0,
    });
    // brutos > 105 → con_seguridad = brutos = 133.33
    expect(res.con_seguridad).toBeCloseTo(133.33, 1);
  });

  it('nunca devuelve disponibles negativos', () => {
    const res = calcularDisponibilidad({
      necesidad: 100,
      stock: 10,
      comprometido: 40,
    });
    expect(res.disponible).toBe(0);
    // brutos ≈ 133.33, disponible = 0 → faltante ≈ 133.33
    expect(res.faltante).toBeCloseTo(133.33, 1);
  });

  it('sin merma (mermaPct: 0) → brutos = necesidad', () => {
    const res = calcularDisponibilidad({
      necesidad: 100, mermaPct: 0,
      stock: 80, comprometido: 0,
    });
    expect(res.brutos).toBe(100);
    expect(res.faltante).toBe(20);
  });
});