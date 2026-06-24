import { describe, it, expect } from 'vitest';
import {
  calcMesas,
  calcCamareros,
  calcOperaciones,
  RATIOS_DEFAULT,
} from '../src/lib/operations';

describe('operations — mesas', () => {
  it('120 adultos → 12 mesas (ceil(120/10))', () => {
    expect(calcMesas(120)).toBe(12);
  });
  it('redondea hacia arriba: 121 adultos → 13 mesas', () => {
    expect(calcMesas(121)).toBe(13);
  });
  it('0 adultos → 0 mesas', () => {
    expect(calcMesas(0)).toBe(0);
  });
});

describe('operations — camareros (FR-A05)', () => {
  it('cóctel: 120 pax → 10 camareros (ceil(120/12))', () => {
    expect(calcCamareros(120, 'coctel')).toBe(10);
  });
  it('menú: 120 pax → 16 camareros (ceil(120/10)=12 + floor(120/25)=4)', () => {
    expect(calcCamareros(120, 'menu')).toBe(16);
  });
  it('menú: 100 pax → 14 (10 + floor(100/25)=4)', () => {
    expect(calcCamareros(100, 'menu')).toBe(14);
  });
  it('menú: 24 pax → 3 (ceil(24/10)=3 + floor(24/25)=0)', () => {
    expect(calcCamareros(24, 'menu')).toBe(3);
  });
  it('cóctel: 13 pax → 2 (ceil(13/12))', () => {
    expect(calcCamareros(13, 'coctel')).toBe(2);
  });
  it('0 pax → 0 camareros', () => {
    expect(calcCamareros(0, 'menu')).toBe(0);
    expect(calcCamareros(0, 'coctel')).toBe(0);
  });
  it('ratios parametrizables: cambiar settings cambia el resultado', () => {
    const r = { ...RATIOS_DEFAULT, paxPorCamareroCoctel: 15 };
    expect(calcCamareros(120, 'coctel', r)).toBe(8); // ceil(120/15)
  });
});

describe('operations — calcOperaciones (integración)', () => {
  it('120 adultos + 10 niños, menú', () => {
    const r = calcOperaciones(120, 10, 'menu');
    expect(r.pax).toBe(130);
    expect(r.mesas).toBe(12);            // adultos/10
    expect(r.mesasInfantiles).toBe(2);   // ceil(10/8)
    expect(r.camareros).toBe(18);        // ceil(130/10)=13 + floor(130/25)=5
  });
  it('120 adultos, cóctel, sin niños', () => {
    const r = calcOperaciones(120, 0, 'coctel');
    expect(r.mesas).toBe(12);
    expect(r.mesasInfantiles).toBe(0);
    expect(r.camareros).toBe(10);
  });
});
