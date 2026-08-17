/**
 * EventFlow — Tests de disponibilidad de stock por escandallo
 * (función pura: necesario vs stock vs comprometido con margen de seguridad)
 */

import { describe, it, expect } from 'vitest';
import { calcularDisponibilidad } from '@/lib/domain/disponibilidadStock';

describe('calcularDisponibilidad', () => {
  it('calcula faltante cuando el stock no cubre la necesidad con seguridad', () => {
    const res = calcularDisponibilidad({
      necesidad: 100, // g
      conSeguridad: 105, // 100 × 1.05
      stock: 80,
      comprometido: 0,
    });
    expect(res.faltante).toBe(25); // 105 - 80
    expect(res.disponible).toBe(80);
  });

  it('descuenta compromisos de otros eventos del disponible', () => {
    const res = calcularDisponibilidad({
      necesidad: 100, conSeguridad: 105, stock: 150, comprometido: 60,
    });
    expect(res.disponible).toBe(90); // 150 - 60
    expect(res.faltante).toBe(15); // 105 - 90
  });

  it('devuelve faltante 0 si hay stock suficiente', () => {
    const res = calcularDisponibilidad({
      necesidad: 100, conSeguridad: 105, stock: 200, comprometido: 0,
    });
    expect(res.faltante).toBe(0);
  });

  it('nunca devuelve disponibles/faltante negativos', () => {
    const res = calcularDisponibilidad({
      necesidad: 100, conSeguridad: 105, stock: 10, comprometido: 40,
    });
    expect(res.disponible).toBe(0);
    expect(res.faltante).toBe(105);
  });
});
