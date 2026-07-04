/**
 * EventFlow — Ratios de mesas/camareros configurables (pendiente Sprint 4 · G10)
 *
 * `lib/operations.ts` ya aceptaba un parámetro `ratios` opcional desde su
 * creación (su propio docblock decía "se cargarán desde settings") pero
 * ningún llamador lo cargaba nunca — todo el negocio corría siempre sobre
 * `RATIOS_DEFAULT` hardcodeado. Este módulo es server-only (usa `pg` vía
 * `@/lib/db`) precisamente porque `operations.ts` también lo importan
 * componentes de cliente (p.ej. ConfirmacionDashboard.tsx) y no puede
 * arrastrar dependencias de Node al bundle del navegador.
 */
import { getPool } from '@/lib/db';
import { RATIOS_DEFAULT, type OperationRatios } from '@/lib/operations';

/** Ratios configurados en business_settings, con fallback a RATIOS_DEFAULT
 *  (fila ausente o columna nula/inválida) — nunca lanza. */
export async function getOperationRatios(): Promise<OperationRatios> {
  try {
    const result = await getPool().query(
      `SELECT asientos_por_mesa, asientos_por_mesa_infantil,
              pax_por_camarero_coctel, pax_por_camarero_menu, refuerzo_cada
       FROM business_settings LIMIT 1`
    );
    const row = result.rows[0];
    if (!row) return RATIOS_DEFAULT;
    const n = (v: unknown, fallback: number) => (Number(v) > 0 ? Number(v) : fallback);
    return {
      asientosPorMesa: n(row.asientos_por_mesa, RATIOS_DEFAULT.asientosPorMesa),
      asientosPorMesaInfantil: n(row.asientos_por_mesa_infantil, RATIOS_DEFAULT.asientosPorMesaInfantil),
      paxPorCamareroCoctel: n(row.pax_por_camarero_coctel, RATIOS_DEFAULT.paxPorCamareroCoctel),
      paxPorCamareroMenu: n(row.pax_por_camarero_menu, RATIOS_DEFAULT.paxPorCamareroMenu),
      refuerzoCada: n(row.refuerzo_cada, RATIOS_DEFAULT.refuerzoCada),
    };
  } catch {
    return RATIOS_DEFAULT;
  }
}
