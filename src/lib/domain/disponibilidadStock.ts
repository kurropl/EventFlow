/**
 * EventFlow — Dominio: disponibilidad de stock por escandallo
 *
 * Función pura (sin BD): compara la necesidad (receta × pax con margen de
 * merma y seguridad) contra el stock disponible (Σ lotes − comprometidos de
 * otros eventos). Devuelve el faltante para informar al panel de escandallos.
 *
 * Fórmula de merma (C2): cantidad a comprar = qty_neta / (1 − mermaPct)
 *   ejemplo: 25% merma → qty_neta / 0.75 = qty_neta × 1.333…
 *
 * El cálculo es INFORMATIVO en escandallos; la compra se gestiona en
 * Stock/Compras con cantidades brutas (merma incluida).
 */

export interface DisponibilidadInput {
  /** Cantidad necesaria neta (receta × pax) */
  necesidad: number;
  /** Merma del ingrediente como fracción (0.25 = 25 %). Default 0.25. */
  mermaPct?: number;
  /** Cantidad con seguridad ya aplicada (con_seguridad se muestra tal cual).
   *  Si no se provee, se calcula automáticamente: brutos * (1 + seguridad_pct). */
  conSeguridad?: number;
  /** Stock actual del ingrediente (Σ qty_base_remaining de sus lotes) */
  stock: number;
  /** Comprometido por OTROS eventos (inventory_commitments) */
  comprometido: number;
}

export interface DisponibilidadResult {
  /** Cantidad neta (receta × pax) */
  necesario: number;
  /** Cantidad bruta a comprar = necesario / (1 − mermaPct) */
  brutos: number;
  con_seguridad: number;
  stock: number;
  comprometido: number;
  disponible: number;
  faltante: number;
}

/** Factor por defecto de merma (25 %) */
export const DEFAULT_MERMA_PCT = 0.25;

export function calcularDisponibilidad(i: DisponibilidadInput): DisponibilidadResult {
  const stock = Math.max(0, Number(i.stock) || 0);
  const comprometido = Math.max(0, Number(i.comprometido) || 0);
  const necesidad = Math.max(0, Number(i.necesidad) || 0);
  const mermaPct = Math.max(0, Number(i.mermaPct ?? DEFAULT_MERMA_PCT) || 0);
  const divMerm = mermaPct < 1 ? (1 - mermaPct) : 0.001; // evita división por 0
  // C2: cantidad bruta a comprar = neto / (1 − merma)
  const brutos = necesidad / divMerm;
  const disponible = Math.max(0, stock - comprometido);
  // con_seguridad = el mayor entre lo explícito y los brutos
  // (si el caller ya calculó con merma incluida, mejor; si no, usamos los brutos base)
  const conSeguridad = i.conSeguridad != null
    ? Math.max(brutos, Math.max(0, Number(i.conSeguridad) || 0))
    : brutos;
  const faltante = Math.max(0, conSeguridad - disponible);
  return {
    necesario: necesidad,
    brutos,
    con_seguridad: conSeguridad,
    stock,
    comprometido,
    disponible,
    faltante,
  };
}