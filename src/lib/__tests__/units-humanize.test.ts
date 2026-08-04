/**
 * EventFlow — Tests de humanizeUnit (normalización de presentación)
 *
 * Regla: 200000 g debe mostrarse como 200 kg; 5000 ml como 5 l.
 * El cálculo nunca se toca (solo la presentación).
 */

import { describe, it, expect } from 'vitest';
import { humanizeUnit } from '../units-pure';

describe('humanizeUnit — masa', () => {
  it('convierte 200000 g → 200 kg', () => {
    expect(humanizeUnit(200000, 'g')).toEqual({ qty: 200, unit: 'kg' });
  });

  it('convierte 1500 g → 1.5 kg', () => {
    expect(humanizeUnit(1500, 'g')).toEqual({ qty: 1.5, unit: 'kg' });
  });

  it('mantiene g si es menor que 1000', () => {
    expect(humanizeUnit(750, 'g')).toEqual({ qty: 750, unit: 'g' });
  });

  it('mantiene exactamente 1000 g → 1 kg (umbral inclusivo)', () => {
    expect(humanizeUnit(1000, 'g')).toEqual({ qty: 1, unit: 'kg' });
  });

  it('mantiene kg si ya está en kg (no re-convierte)', () => {
    expect(humanizeUnit(200, 'kg')).toEqual({ qty: 200, unit: 'kg' });
  });
});

describe('humanizeUnit — volumen', () => {
  it('convierte 5000 ml → 5 l', () => {
    expect(humanizeUnit(5000, 'ml')).toEqual({ qty: 5, unit: 'l' });
  });

  it('mantiene ml si es menor que 1000', () => {
    expect(humanizeUnit(250, 'ml')).toEqual({ qty: 250, unit: 'ml' });
  });

  it('mantiene l si ya está en l', () => {
    expect(humanizeUnit(3, 'l')).toEqual({ qty: 3, unit: 'l' });
  });
});

describe('humanizeUnit — conteo y unidades no convertibles', () => {
  it('mantiene ud sin cambios', () => {
    expect(humanizeUnit(42, 'ud')).toEqual({ qty: 42, unit: 'ud' });
  });

  it('mantiene unidades desconocidas sin cambios', () => {
    expect(humanizeUnit(5, 'cajas')).toEqual({ qty: 5, unit: 'cajas' });
  });

  it('no rompe con cero', () => {
    expect(humanizeUnit(0, 'g')).toEqual({ qty: 0, unit: 'g' });
  });
});
