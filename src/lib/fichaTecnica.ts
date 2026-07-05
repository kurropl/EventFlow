/**
 * EventFlow — Ficha técnica de recetas
 *
 * Réplica del modelo de PLANTILLA_FICHA_TECNICA_AUTOMATIZADA.xlsx: cálculo
 * de coste y precio de un plato a partir de su lista de ingredientes.
 *
 *   peso total       = Σ cantidad de cada línea de ingrediente
 *   raciones         = peso total ÷ peso objetivo por ración
 *   coste materia prima = Σ (cantidad × coste unitario del ingrediente)
 *   coste total       = coste materia prima × (1 + merma_pct / 100)
 *   coste unitario     = coste total ÷ raciones
 *   precio mínimo      = coste unitario × multiplicador (Configuración, def. 3)
 *   beneficio unitario  = precio venta − coste unitario
 *   beneficio total     = (precio venta × raciones) − coste total
 *
 * A diferencia del Excel (que muestra #DIV/0! con divisores en 0/vacío),
 * aquí toda división por un divisor ≤ 0 devuelve `null` para que la UI
 * pueda mostrar "—" en vez de un error.
 */

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export interface FichaLinea {
  quantity: number;
  unitCost: number;
}

export interface FichaTotales {
  pesoTotal: number;
  raciones: number | null;
  costeMateriaPrima: number;
  costeTotal: number;
  costeUnitario: number | null;
  precioMinimo: number | null;
  beneficioUnitario: number | null;
  beneficioTotal: number | null;
}

export function computeFichaTotales(
  lineas: FichaLinea[],
  mermaPct: number,
  pesoRacion: number | null,
  minPriceMultiplier: number,
  precioVenta: number | null
): FichaTotales {
  // Toda la cascada se calcula en precisión completa y solo se redondea el
  // valor final de cada campo — redondear un resultado intermedio (p.ej.
  // el peso total) y reutilizarlo para dividir arrastra el error aguas
  // abajo. Con cantidades pequeñas (una yema a 0.002 kg en una receta de
  // 214 raciones) redondear el peso total a 2 decimales antes de dividir
  // por el peso/ración cambiaba las raciones de 214.2 a 214 exactas.
  const pesoTotalRaw = lineas.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
  const racionesRaw = pesoRacion && pesoRacion > 0 ? pesoTotalRaw / pesoRacion : null;

  const costeMateriaPrimaRaw = lineas.reduce(
    (s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0
  );
  const merma = Math.max(0, Number(mermaPct) || 0);
  const costeTotalRaw = costeMateriaPrimaRaw * (1 + merma / 100);

  const costeUnitarioRaw = racionesRaw && racionesRaw > 0 ? costeTotalRaw / racionesRaw : null;
  const precioMinimoRaw = costeUnitarioRaw != null ? costeUnitarioRaw * (Number(minPriceMultiplier) || 0) : null;

  const beneficioUnitarioRaw =
    precioVenta != null && costeUnitarioRaw != null ? precioVenta - costeUnitarioRaw : null;
  const beneficioTotalRaw =
    precioVenta != null && racionesRaw != null ? precioVenta * racionesRaw - costeTotalRaw : null;

  return {
    pesoTotal: round2(pesoTotalRaw),
    raciones: racionesRaw != null ? round2(racionesRaw) : null,
    costeMateriaPrima: round2(costeMateriaPrimaRaw),
    costeTotal: round2(costeTotalRaw),
    costeUnitario: costeUnitarioRaw != null ? round2(costeUnitarioRaw) : null,
    precioMinimo: precioMinimoRaw != null ? round2(precioMinimoRaw) : null,
    beneficioUnitario: beneficioUnitarioRaw != null ? round2(beneficioUnitarioRaw) : null,
    beneficioTotal: beneficioTotalRaw != null ? round2(beneficioTotalRaw) : null,
  };
}
