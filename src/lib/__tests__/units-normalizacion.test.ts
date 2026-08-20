/**
 * EventFlow — Tests de normalización de unidades (C5)
 *
 * Verifica que las conversiones g→kg, ml→l, ud→ud funcionan
 * correctamente tras la normalización de la migración 038.
 *
 * Estos tests usan las funciones puras de units-pure.ts
 * (sin BD) para verificar el motor de conversión base.
 */

import { describe, it, expect } from 'vitest';
import { convertUnit, normalizeToBase, getDimension, areSameDimension } from '../units-pure';

describe('C5: g → kg (masa)', () => {
  it('500 g → 0.5 kg', () => {
    expect(convertUnit(500, 'g', 'kg')).toBe(0.5);
  });

  it('1500 g → 1.5 kg', () => {
    expect(convertUnit(1500, 'g', 'kg')).toBe(1.5);
  });

  it('2000 g → 2 kg', () => {
    expect(convertUnit(2000, 'g', 'kg')).toBe(2);
  });

  it('1 kg → 1000 g', () => {
    expect(convertUnit(1, 'kg', 'g')).toBe(1000);
  });

  it('3.5 kg → 3500 g', () => {
    expect(convertUnit(3.5, 'kg', 'g')).toBe(3500);
  });

  it('normalizeToBase(1.5, kg) → 1500', () => {
    expect(normalizeToBase(1.5, 'kg')).toBe(1500);
  });

  it('fromBase: 1500 g → 1.5 kg (equivalencia con convertUnit)', () => {
    // fromBaseTo(1500, 'kg') equivale a convertUnit(1500, 'g', 'kg')
    expect(convertUnit(1500, 'g', 'kg')).toBe(1.5);
  });

  it('g y kg son misma dimensión', () => {
    expect(getDimension('g')).toBe('mass');
    expect(getDimension('kg')).toBe('mass');
    expect(areSameDimension('g', 'kg')).toBe(true);
  });
});

describe('C5: ml → l (volumen)', () => {
  it('250 ml → 0.25 l', () => {
    expect(convertUnit(250, 'ml', 'l')).toBe(0.25);
  });

  it('1500 ml → 1.5 l', () => {
    expect(convertUnit(1500, 'ml', 'l')).toBe(1.5);
  });

  it('5000 ml → 5 l', () => {
    expect(convertUnit(5000, 'ml', 'l')).toBe(5);
  });

  it('0.5 l → 500 ml', () => {
    expect(convertUnit(0.5, 'l', 'ml')).toBe(500);
  });

  it('2 l → 2000 ml', () => {
    expect(convertUnit(2, 'l', 'ml')).toBe(2000);
  });

  it('normalizeToBase(2, l) → 2000', () => {
    expect(normalizeToBase(2, 'l')).toBe(2000);
  });

  it('fromBase: 2000 ml → 2 l (equivalencia con convertUnit)', () => {
    // fromBaseTo(2000, 'l') equivale a convertUnit(2000, 'ml', 'l')
    expect(convertUnit(2000, 'ml', 'l')).toBe(2);
  });

  it('ml y l son misma dimensión', () => {
    expect(getDimension('ml')).toBe('volume');
    expect(getDimension('l')).toBe('volume');
    expect(areSameDimension('ml', 'l')).toBe(true);
  });
});

describe('C5: ud → ud (conteo, no-op)', () => {
  it('50 ud → 50 ud', () => {
    expect(convertUnit(50, 'ud', 'ud')).toBe(50);
  });

  it('normalizeToBase(50, ud) → 50', () => {
    expect(normalizeToBase(50, 'ud')).toBe(50);
  });

  it('fromBase: 50 ud → 50 (no-op, ya en base)', () => {
    // fromBaseTo(50, 'ud') es no-op porque ud ya es la unidad base de count
    expect(normalizeToBase(50, 'ud')).toBe(50);
  });

  it('ud tiene dimensión count', () => {
    expect(getDimension('ud')).toBe('count');
  });

  it('ud y doc son misma dimensión', () => {
    expect(areSameDimension('ud', 'doc')).toBe(true);
  });
});

describe('C5: cruzado prohibido entre dimensiones', () => {
  it('g no se puede convertir a ml', () => {
    expect(() => convertUnit(100, 'g', 'ml')).toThrow();
  });

  it('ud no se puede convertir a g', () => {
    expect(() => convertUnit(10, 'ud', 'g')).toThrow();
  });

  it('l no se puede convertir a ud', () => {
    expect(() => convertUnit(1, 'l', 'ud')).toThrow();
  });
});