/**
 * EventFlow — Cálculo de operaciones (mesas y camareros)  ·  FR-A05
 *
 * Fuente ÚNICA de la fórmula de personal/mesas (constitución §1).
 * Decisión del cliente (confirmada):
 *   - mesas        = ceil(comensales_adultos / asientos_por_mesa)   [10]
 *   - cóctel       = ceil(pax / pax_por_camarero_coctel)            [12]
 *   - menú sentado = ceil(pax / pax_por_camarero_menu) + floor(pax / refuerzo_cada) [10 + cada 25]
 *
 * `pax` = comensales totales (adultos + niños) para el reparto de camareros.
 * Los ratios son parametrizables (se cargarán desde `settings`; aquí van los
 * valores por defecto del negocio).
 */

export type ServiceType = 'coctel' | 'menu';

export interface OperationRatios {
  asientosPorMesa: number;        // comensales por mesa de adultos
  asientosPorMesaInfantil: number; // niños por mesa infantil
  paxPorCamareroCoctel: number;   // cóctel: 1 camarero cada N
  paxPorCamareroMenu: number;     // menú: base 1 camarero cada N
  refuerzoCada: number;           // menú: +1 camarero cada N adicionales
}

export const RATIOS_DEFAULT: OperationRatios = {
  asientosPorMesa: 10,
  asientosPorMesaInfantil: 8,
  paxPorCamareroCoctel: 12,
  paxPorCamareroMenu: 10,
  refuerzoCada: 25,
};

const toNum = (n: number) => {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : 0;
};

/** Mesas de adultos = ceil(adultos / asientosPorMesa). */
export function calcMesas(adultos: number, ratios: OperationRatios = RATIOS_DEFAULT): number {
  const a = toNum(adultos);
  if (a === 0) return 0;
  return Math.ceil(a / ratios.asientosPorMesa);
}

/** Mesas infantiles (opcional) = ceil(niños / asientosPorMesaInfantil). */
export function calcMesasInfantiles(ninos: number, ratios: OperationRatios = RATIOS_DEFAULT): number {
  const k = toNum(ninos);
  if (k === 0) return 0;
  return Math.ceil(k / ratios.asientosPorMesaInfantil);
}

/**
 * Camareros según tipo de servicio (FR-A05):
 *   cóctel → ceil(pax / 12)
 *   menú   → ceil(pax / 10) + floor(pax / 25)
 */
export function calcCamareros(
  pax: number,
  serviceType: ServiceType,
  ratios: OperationRatios = RATIOS_DEFAULT
): number {
  const p = toNum(pax);
  if (p === 0) return 0;
  if (serviceType === 'coctel') {
    return Math.ceil(p / ratios.paxPorCamareroCoctel);
  }
  // menú sentado
  return Math.ceil(p / ratios.paxPorCamareroMenu) + Math.floor(p / ratios.refuerzoCada);
}

export interface OperationNeeds {
  pax: number;
  mesas: number;
  mesasInfantiles: number;
  camareros: number;
  serviceType: ServiceType;
}

/** Cálculo completo de necesidades operativas de un evento. */
export function calcOperaciones(
  adultos: number,
  ninos: number,
  serviceType: ServiceType = 'menu',
  ratios: OperationRatios = RATIOS_DEFAULT
): OperationNeeds {
  const a = toNum(adultos);
  const k = toNum(ninos);
  const pax = a + k;
  return {
    pax,
    mesas: calcMesas(a, ratios),
    mesasInfantiles: calcMesasInfantiles(k, ratios),
    camareros: calcCamareros(pax, serviceType, ratios),
    serviceType,
  };
}
