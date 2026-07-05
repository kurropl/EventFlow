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
  const pesoTotal = round2(lineas.reduce((s, l) => s + (Number(l.quantity) || 0), 0));
  const raciones = pesoRacion && pesoRacion > 0 ? round2(pesoTotal / pesoRacion) : null;

  const costeMateriaPrima = round2(
    lineas.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0)
  );
  const merma = Math.max(0, Number(mermaPct) || 0);
  const costeTotal = round2(costeMateriaPrima * (1 + merma / 100));

  const costeUnitario = raciones && raciones > 0 ? round2(costeTotal / raciones) : null;
  const precioMinimo = costeUnitario != null ? round2(costeUnitario * (Number(minPriceMultiplier) || 0)) : null;

  const beneficioUnitario =
    precioVenta != null && costeUnitario != null ? round2(precioVenta - costeUnitario) : null;
  const beneficioTotal =
    precioVenta != null && raciones != null ? round2(precioVenta * raciones - costeTotal) : null;

  return {
    pesoTotal,
    raciones,
    costeMateriaPrima,
    costeTotal,
    costeUnitario,
    precioMinimo,
    beneficioUnitario,
    beneficioTotal,
  };
}
