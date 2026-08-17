/**
 * EventFlow — Dominio: datos maestros proveedor × ingrediente
 *
 * Función pura: redondea una necesidad (en la unidad de uso del
 * ingrediente) a la unidad de compra del proveedor, respetando el pedido
 * mínimo. Ej: necesitas 4.7 kg y el proveedor vende cajas de 6 kg →
 * 1 caja = 6 kg.
 */

export interface CompraInput {
  /** Necesidad en la unidad de uso del ingrediente (kg, g, ud…) */
  necesidadKg: number;
  /** Unidades de uso por unidad de compra (6 kg por caja → 6) */
  factorConversion: number;
  /** Pedido mínimo en unidades de compra */
  pedidoMinimo: number;
}

export interface CompraResult {
  /** Unidades de compra a pedir */
  unidades: number;
  /** Cantidad real que llega (unidades × factor), en unidad de uso */
  cantidadRealKg: number;
}

export function calcularUnidadesCompra(i: CompraInput): CompraResult {
  const necesidad = Math.max(0, Number(i.necesidadKg) || 0);
  const factor = Math.max(0, Number(i.factorConversion) || 0);
  const minimo = Math.max(0, Number(i.pedidoMinimo) || 0);
  if (necesidad <= 0) return { unidades: 0, cantidadRealKg: 0 };
  // factor 0/inválido → 1 unidad base por unidad de necesidad
  const unidadesPorNecesidad = factor > 0 ? necesidad / factor : necesidad;
  const unidades = Math.max(Math.ceil(unidadesPorNecesidad), minimo);
  return {
    unidades,
    cantidadRealKg: unidades * (factor > 0 ? factor : 1),
  };
}
