// Tests de propuesta OC y regularizaciones
import { describe, it, expect } from 'vitest';
import { agruparPorProveedor } from '@/lib/domain/propuestaOC';
import { validarAjuste } from '@/lib/domain/regularizaciones';

describe('agruparPorProveedor', () => {
  it('agrupa faltantes por proveedor', () => {
    const items = [
      { ingredient_id: 'a', nombre: 'Ternera', faltante: 5000, supplier: 'Cárnicas' },
      { ingredient_id: 'b', nombre: 'Chorizo', faltante: 3000, supplier: 'Cárnicas' },
      { ingredient_id: 'c', nombre: 'Vino', faltante: 20000, supplier: 'Bodega' },
    ];
    const res = agruparPorProveedor(items);
    expect(Object.keys(res)).toHaveLength(2);
    expect(res['Cárnicas']).toHaveLength(2);
  });
  it('asigna a Sin proveedor si no tiene', () => {
    const items = [{ ingredient_id: 'a', nombre: 'X', faltante: 10, supplier: null }];
    const res = agruparPorProveedor(items);
    expect(res['Sin proveedor']).toHaveLength(1);
  });
});

describe('validarAjuste', () => {
  it('rechaza ajuste 0', () => { expect(validarAjuste(0, 'recuento')).toBe(false); });
  it('acepta negativo con tipo válido', () => { expect(validarAjuste(-5, 'rotura')).toBe(true); });
  it('acepta sobrante positivo', () => { expect(validarAjuste(3, 'sobrante')).toBe(true); });
  it('rechaza tipo inválido', () => { expect(validarAjuste(-1, 'inventado')).toBe(false); });
});