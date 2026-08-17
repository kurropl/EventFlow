/**
 * EventFlow — Tests: redondeo a unidad de compra
 * (datos maestros proveedor×ingrediente)
 */

import { describe, it, expect } from 'vitest';
import { calcularUnidadesCompra } from '@/lib/domain/supplierPricing';

describe('calcularUnidadesCompra', () => {
  it('redondea a la unidad de compra (4.7 kg → 1 caja de 6 kg)', () => {
    const res = calcularUnidadesCompra({ necesidadKg: 4.7, factorConversion: 6, pedidoMinimo: 0 });
    expect(res.unidades).toBe(1);
    expect(res.cantidadRealKg).toBe(6);
  });

  it('respeta el pedido mínimo', () => {
    const res = calcularUnidadesCompra({ necesidadKg: 2, factorConversion: 6, pedidoMinimo: 2 });
    expect(res.unidades).toBe(2); // mínimo 2 cajas
  });

  it('devuelve 0 si no hay necesidad', () => {
    const res = calcularUnidadesCompra({ necesidadKg: 0, factorConversion: 6, pedidoMinimo: 0 });
    expect(res.unidades).toBe(0);
  });

  it('protege contra factor 0 o negativo', () => {
    const res = calcularUnidadesCompra({ necesidadKg: 10, factorConversion: 0, pedidoMinimo: 0 });
    expect(res.unidades).toBe(10); // factor inválido → 1 unidad base por kg
  });
});
