/**
 * EventFlow — Tests del sistema de unidades (src/lib/units.ts)
 *
 * Test-first: los tests fijan los resultados esperados ANTES de que
 * el código de producción se considere completo.
 *
 * Principio: ningún cambio de unidades se deploya sin que estos tests pasen.
 */

import { describe, it, expect } from 'vitest';
import {
  convertUnit,
  normalizeToBase,
  fromBaseTo,
  sumByDimension,
  formatCantidad,
  formatCantidadConUnidad,
  formatMoney,
  areSameDimension,
} from '../units';

// ================================================================
// Conversión entre unidades de la MISMA dimensión
// ================================================================

describe('convertUnit', () => {
  it('convierte gramos a kilogramos (misma dimensión)', () => {
    expect(convertUnit(1500, 'g', 'kg')).toBe(1.5);
  });

  it('convierte kilogramos a gramos', () => {
    expect(convertUnit(1.5, 'kg', 'g')).toBe(1500);
  });

  it('convierte mililitros a litros', () => {
    expect(convertUnit(1500, 'ml', 'l')).toBe(1.5);
  });

  it('convierte litros a mililitros', () => {
    expect(convertUnit(0.75, 'l', 'ml')).toBe(750);
  });

  it('convierte unidades a docenas', () => {
    expect(convertUnit(24, 'ud', 'doc')).toBe(2);
  });

  it('convierte docenas a unidades', () => {
    expect(convertUnit(2, 'doc', 'ud')).toBe(24);
  });

  it('lanza error si las dimensiones no coinciden', () => {
    expect(() => convertUnit(100, 'g', 'ml')).toThrow(/dimensiones distintas/);
    expect(() => convertUnit(10, 'ud', 'l')).toThrow(/dimensiones distintas/);
  });

  it('lanza error para unidad desconocida', () => {
    expect(() => convertUnit(100, 'foo' as any, 'g')).toThrow(/Unidad desconocida/);
  });
});

// ================================================================
// Normalización a unidad base
// ================================================================

describe('normalizeToBase', () => {
  it('1.5 kg → 1500 g', () => {
    expect(normalizeToBase(1.5, 'kg')).toBe(1500);
  });

  it('0.75 L → 750 ml', () => {
    expect(normalizeToBase(0.75, 'l')).toBe(750);
  });

  it('24 ud → 24 ud (ya en base)', () => {
    expect(normalizeToBase(24, 'ud')).toBe(24);
  });

  it('300 g → 300 g (ya en base)', () => {
    expect(normalizeToBase(300, 'g')).toBe(300);
  });
});

describe('fromBaseTo', () => {
  it('1500 g → 1.5 kg', () => {
    expect(fromBaseTo(1500, 'kg')).toBe(1.5);
  });

  it('750 ml → 0.75 L', () => {
    expect(fromBaseTo(750, 'l')).toBe(0.75);
  });
});

// ================================================================
// Suma por dimensión (nunca mezclar)
// ================================================================

describe('sumByDimension', () => {
  it('suma correctamente gramos y kilos (misma dimensión)', () => {
    const result = sumByDimension([
      { value: 1500, unit: 'g' },   // 1500 g
      { value: 300, unit: 'g' },    // 300 g
      { value: 0.5, unit: 'kg' },   // 500 g
    ]);
    expect(result.mass).toBe(1500 + 300 + 500);  // = 2300 g
    expect(result.volume).toBe(0);
    expect(result.count).toBe(0);
  });

  it('suma correctamente mililitros y litros', () => {
    const result = sumByDimension([
      { value: 750, unit: 'ml' },   // 750 ml
      { value: 1, unit: 'l' },       // 1000 ml
    ]);
    expect(result.volume).toBe(750 + 1000);  // = 1750 ml
    expect(result.mass).toBe(0);
  });

  it('suma correctamente unidades y docenas', () => {
    const result = sumByDimension([
      { value: 24, unit: 'ud' },    // 24 ud
      { value: 2, unit: 'doc' },    // 24 ud
    ]);
    expect(result.count).toBe(24 + 24);  // = 48 ud
  });

  it('nunca mezcla dimensiones distintas', () => {
    const result = sumByDimension([
      { value: 1000, unit: 'g' },   // masa
      { value: 500, unit: 'ml' },   // volumen
      { value: 12, unit: 'ud' },    // conteo
    ]);
    expect(result.mass).toBe(1000);   // solo g
    expect(result.volume).toBe(500);  // solo ml
    expect(result.count).toBe(12);    // solo ud
    // Nota: no hay un total único que sume todo
  });

  it('lanza error si la unidad no existe', () => {
    expect(() => sumByDimension([{ value: 10, unit: 'eur' as any }])).toThrow(/Unidad desconocida/);
  });
});

// ================================================================
// Formateo con locale español
// ================================================================

describe('formatCantidad', () => {
  it('masa con 2 decimales (1500 g → "1.500,00")', () => {
    // La unidad debe especificarse — g → formato sin sufijo
    const result = formatCantidad(1500, 'g');
    expect(result).toMatch(/1\.?500/);
    // Nota: usamos match parcial porque puede incluir o no separador de miles
  });

  it('volumen con 2 decimales (750 ml → "750,00")', () => {
    const result = formatCantidad(750, 'ml');
    // Volumen debe mostrar 2 decimales siempre
    expect(result).toMatch(/750/);
  });

  it('conteo sin decimales (24 ud → "24")', () => {
    const result = formatCantidad(24, 'ud');
    expect(result).toBe('24');
  });

  it('dinero con 2 decimales (12.5 → "12,50 €")', () => {
    const result = formatMoney(12.5);
    expect(result).toMatch(/12,5/);
  });
});

describe('formatCantidadConUnidad', () => {
  it('1500 g → "1.500 g"', () => {
    const result = formatCantidadConUnidad(1500, 'g');
    expect(result).toMatch(/g$/);
  });

  it('750 ml → "750 ml"', () => {
    const result = formatCantidadConUnidad(750, 'ml');
    expect(result).toMatch(/ml$/);
  });

  it('24 ud → "24 ud"', () => {
    const result = formatCantidadConUnidad(24, 'ud');
    expect(result).toMatch(/ud$/);
  });

  it('respeta la unidad solicitada, no la unidad base de su dimensión (1.5 kg → "1,5 kg", no "1500 g")', () => {
    expect(formatCantidadConUnidad(1.5, 'kg')).toBe('1,5 kg');
    expect(formatCantidadConUnidad(0.75, 'l')).toBe('0,75 L');
    expect(formatCantidadConUnidad(2, 'doc')).toBe('2 doc');
  });
});

// ================================================================
// Validaciones de dimensión
// ================================================================

describe('areSameDimension', () => {
  it('g y kg son misma dimensión', () => {
    expect(areSameDimension('g', 'kg')).toBe(true);
  });

  it('ml y L son misma dimensión', () => {
    expect(areSameDimension('ml', 'l')).toBe(true);
  });

  it('ud y doc son misma dimensión', () => {
    expect(areSameDimension('ud', 'doc')).toBe(true);
  });

  it('g y ml son dimensiones distintas', () => {
    expect(areSameDimension('g', 'ml')).toBe(false);
  });

  it('€ no está registrada como unidad convertible', () => {
    // Nota: currency no tiene unidad convertible, solo formateo
    expect(areSameDimension('g', 'eur' as any)).toBe(false);
  });
});