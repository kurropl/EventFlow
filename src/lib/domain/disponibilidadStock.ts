/**
 * EventFlow — Dominio: disponibilidad de stock por escandallo
 *
 * Función pura (sin BD): compara la necesidad (receta × pax con margen de
 * seguridad) contra el stock disponible (Σ lotes − comprometidos de otros
 * eventos). Devuelve el faltante para informar al panel de escandallos.
 *
 * El cálculo es INFORMATIVO en escandallos; la compra se gestiona en
 * Stock/Compras.
 */

export interface DisponibilidadInput {
  /** Cantidad necesaria sin margen (g, ml, ud…) */
  necesidad: number;
  /** Cantidad con margen de seguridad aplicado (necesidad × (1+seguridad)) */
  conSeguridad: number;
  /** Stock actual del ingrediente (Σ qty_base_remaining de sus lotes) */
  stock: number;
  /** Comprometido por OTROS eventos (inventory_commitments) */
  comprometido: number;
}

export interface DisponibilidadResult {
  necesario: number;
  con_seguridad: number;
  stock: number;
  comprometido: number;
  disponible: number;
  faltante: number;
}

export function calcularDisponibilidad(i: DisponibilidadInput): DisponibilidadResult {
  const stock = Math.max(0, Number(i.stock) || 0);
  const comprometido = Math.max(0, Number(i.comprometido) || 0);
  const conSeguridad = Math.max(0, Number(i.conSeguridad) || 0);
  const disponible = Math.max(0, stock - comprometido);
  const faltante = Math.max(0, conSeguridad - disponible);
  return {
    necesario: Math.max(0, Number(i.necesidad) || 0),
    con_seguridad: conSeguridad,
    stock,
    comprometido,
    disponible,
    faltante,
  };
}
