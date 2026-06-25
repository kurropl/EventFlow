/**
 * EventFlow — Tests del workflow de presupuestos (4 fases)  ·  FR-A01…A04
 */
import { describe, it, expect } from 'vitest';
import { toPhase, canCancel, canEditOnlyPriceAndGuests, isCancellation, ACTIVE_PHASES } from '../quoteWorkflow';

describe('toPhase — estados técnicos → fases visibles', () => {
  it('draft/historical → borrador', () => {
    expect(toPhase('draft')).toBe('borrador');
    expect(toPhase('historical')).toBe('borrador');
  });
  it('sent → 1º contacto', () => {
    expect(toPhase('sent')).toBe('contacto');
  });
  it('accepted/in_progress → aceptado', () => {
    expect(toPhase('accepted')).toBe('aceptado');
    expect(toPhase('in_progress')).toBe('aceptado');
  });
  it('completed/paid → realizado', () => {
    expect(toPhase('completed')).toBe('realizado');
    expect(toPhase('paid')).toBe('realizado');
  });
  it('cancelled/rejected/lost/expired → descartado', () => {
    for (const s of ['cancelled', 'rejected', 'lost', 'expired']) {
      expect(toPhase(s)).toBe('descartado');
    }
  });
  it('hay exactamente 4 fases activas', () => {
    expect(ACTIVE_PHASES).toEqual(['borrador', 'contacto', 'aceptado', 'realizado']);
  });
});

describe('reglas de cancelación (FR-A03/A04)', () => {
  it('se puede cancelar en borrador y 1º contacto', () => {
    expect(canCancel('draft')).toBe(true);
    expect(canCancel('sent')).toBe(true);
  });
  it('NO se puede cancelar un presupuesto aceptado o realizado', () => {
    expect(canCancel('accepted')).toBe(false);
    expect(canCancel('completed')).toBe(false);
  });
  it('isCancellation detecta rechazos/cancelaciones', () => {
    expect(isCancellation('cancelled')).toBe(true);
    expect(isCancellation('rejected')).toBe(true);
    expect(isCancellation('sent')).toBe(false);
  });
});

describe('edición en borrador (FR-A02)', () => {
  it('solo precio+comensales editables en borrador', () => {
    expect(canEditOnlyPriceAndGuests('draft')).toBe(true);
    expect(canEditOnlyPriceAndGuests('sent')).toBe(false);
    expect(canEditOnlyPriceAndGuests('accepted')).toBe(false);
  });
});
