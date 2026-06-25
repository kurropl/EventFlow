/**
 * EventFlow — Cocina como GUÍA del evento  ·  FR-C01…C09 + FR-A07/A11
 *
 * Punto único que orquesta TODO el funcionamiento de cocina, antes y después del
 * evento, y que **cambia según la ubicación**:
 *   - `benitez`  → evento en el local propio: no hay carga de furgoneta y la
 *                  logística usa el equipamiento que ya está in situ.
 *   - `externo`  → catering desplazado: hay Hoja de Carga por pase, la logística
 *                  incluye transporte de equipamiento y el sitting necesita el
 *                  plano (PDF) del venue.
 *
 * Devuelve una lista de FASES guiadas; cada una sabe si aplica a esta ubicación,
 * su estado (pendiente / listo / no aplica) y un resumen con cifras reales.
 *
 * El escandallo es la fuente de verdad (FR-C01): de él derivan compras,
 * producción, carga, logística y trazabilidad.
 */
import { queryMany, querySingle } from '@/lib/db';
import { calcOperaciones, type ServiceType } from '@/lib/operations';

export type VenueType = 'benitez' | 'externo';
export type FaseEstado = 'pendiente' | 'listo' | 'no_aplica' | 'bloqueado';
export type Momento = 'pre' | 'dia' | 'post';

export interface GuiaFase {
  key: string;
  titulo: string;
  momento: Momento;
  aplica: boolean;
  motivo_no_aplica?: string;
  estado: FaseEstado;
  resumen: string;
  detalle?: Record<string, unknown>;
  /** Ruta (API o panel) donde se trabaja esta fase. */
  enlace?: string;
}

export interface CocinaGuia {
  evento: {
    id: string;
    nombre: string;
    fecha: string | null;
    pax: number;
    adultos: number;
    ninos: number;
    serviceType: ServiceType;
    estado: string;
  };
  venue: {
    tipo: VenueType;
    etiqueta: string;
    es_externo: boolean;
    ubicacion: string | null;
    plano_pdf: string | null;
    nota: string;
  };
  escandallo: {
    lineas: number;
    coste_estimado: number;
    coste_real: number;
    congelado: boolean;
  };
  fases: GuiaFase[];
  progreso: { aplicables: number; completadas: number; pct: number };
}

const VENUE_LABEL: Record<VenueType, string> = {
  benitez: 'Salones Benítez (local propio)',
  externo: 'Ubicación externa (catering desplazado)',
};

const money = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Construye la guía de cocina de un evento, condicionada por su ubicación.
 */
export async function buildCocinaGuia(eventId: string): Promise<CocinaGuia | null> {
  const ev = await querySingle<any>(
    `SELECT id, client_name, event_date, guest_count, kids_count, status,
            COALESCE(service_type,'menu')  AS service_type,
            COALESCE(venue_type,'benitez') AS venue_type,
            location, venue_pdf_url, stock_deducted
     FROM events WHERE id = $1`,
    [eventId]
  );
  if (!ev) return null;

  const venue: VenueType = ev.venue_type === 'externo' ? 'externo' : 'benitez';
  const esExterno = venue === 'externo';
  const serviceType: ServiceType = ev.service_type === 'coctel' ? 'coctel' : 'menu';
  const adultos = Number(ev.guest_count) || 0;
  const ninos = Number(ev.kids_count) || 0;
  const ops = calcOperaciones(adultos, ninos, serviceType);
  const completado = ['completed', 'completado', 'paid', 'pagado'].includes(ev.status);

  // ── Escandallo (fuente de verdad) ───────────────────────────────────────
  const esc = await querySingle<any>(
    `SELECT COUNT(*)::int AS lineas,
            COALESCE(SUM(estimated_cost),0)    AS coste_estimado,
            COALESCE(SUM(actual_cost_total),0) AS coste_real,
            bool_or(frozen)                    AS congelado
     FROM event_shopping_items WHERE event_id = $1`,
    [eventId]
  );
  const lineas = Number(esc?.lineas) || 0;
  const costeEst = money(esc?.coste_estimado);
  const costeReal = money(esc?.coste_real);
  const congelado = !!esc?.congelado;
  const hayEscandallo = lineas > 0;

  // ── Compras: déficit de stock para cubrir el escandallo ─────────────────
  const deficit = await queryMany<any>(
    `SELECT esi.ingredient_name,
            esi.total_grams, esi.total_ml, esi.total_units,
            i.unit, COALESCE(i.quantity,0) AS stock
     FROM event_shopping_items esi
     LEFT JOIN ingredients i ON i.id = esi.ingredient_id
     WHERE esi.event_id = $1`,
    [eventId]
  );
  let faltan = 0;
  for (const d of deficit) {
    const u = (d.unit || '').toLowerCase();
    const need = u === 'kg' ? Number(d.total_grams) / 1000
      : u === 'g' || u === 'gr' ? Number(d.total_grams)
      : u === 'l' ? Number(d.total_ml) / 1000
      : u === 'ml' ? Number(d.total_ml)
      : Number(d.total_units);
    if (d.stock !== null && Number(need) > Number(d.stock)) faltan++;
  }

  // ── Recepción APPCC (lotes) — recepciones registradas para el evento ────
  let lotes = 0;
  try {
    const r = await querySingle<any>(
      `SELECT COUNT(*)::int AS n FROM lot_consumption WHERE event_id = $1`, [eventId]
    );
    lotes = Number(r?.n) || 0;
  } catch { lotes = 0; }

  // ── Factura (cierre) ────────────────────────────────────────────────────
  let facturaHecha = false;
  try {
    const inv = await querySingle<any>(`SELECT 1 FROM invoices WHERE event_id = $1 LIMIT 1`, [eventId]);
    facturaHecha = !!inv;
  } catch { facturaHecha = false; }

  // ── Fases de la guía ────────────────────────────────────────────────────
  const fases: GuiaFase[] = [];

  // PRE — 1. Escandallo teórico
  fases.push({
    key: 'escandallo_teorico', titulo: 'Escandallo teórico (receta × comensales)', momento: 'pre',
    aplica: true,
    estado: hayEscandallo ? 'listo' : 'pendiente',
    resumen: hayEscandallo
      ? `${lineas} ingredientes · coste estimado ${costeEst.toFixed(2)} € para ${ops.pax} pax`
      : 'Aún no se ha generado. Se crea al aceptar el presupuesto.',
    detalle: { lineas, coste_estimado: costeEst, pax: ops.pax, mesas: ops.mesas, camareros: ops.camareros },
    enlace: `/api/escandallo/event/${eventId}`,
  });

  // PRE — 2. Compras / pedidos a proveedor
  fases.push({
    key: 'compras', titulo: 'Compras y pedidos a proveedor', momento: 'pre',
    aplica: true,
    estado: !hayEscandallo ? 'bloqueado' : faltan === 0 ? 'listo' : 'pendiente',
    resumen: !hayEscandallo ? 'Requiere escandallo.'
      : faltan === 0 ? 'Stock suficiente para todos los ingredientes.'
      : `${faltan} ingrediente(s) por debajo del stock necesario — generar pedido.`,
    detalle: { ingredientes_en_deficit: faltan },
    enlace: `/api/stock/generate-order`,
  });

  // PRE — 3. Recepción de mercancía (APPCC: lotes + fecha entrada)
  fases.push({
    key: 'recepcion_appcc', titulo: 'Recepción de mercancía (APPCC: lotes y fecha de entrada)', momento: 'pre',
    aplica: true,
    estado: lotes > 0 ? 'listo' : 'pendiente',
    resumen: lotes > 0
      ? `${lotes} lote(s) registrados para trazabilidad sanitaria.`
      : 'Escanear/registrar la recepción de cada mercancía (lote, fecha, caducidad).',
    enlace: `/api/trazabilidad/receiving`,
  });

  // PRE — 4. Hoja de Producción (qué cocinar, por pase)
  fases.push({
    key: 'produccion', titulo: 'Hoja de Producción (qué cocinar, por pase)', momento: 'pre',
    aplica: true,
    estado: hayEscandallo ? 'listo' : 'bloqueado',
    resumen: hayEscandallo ? 'Lista para imprimir: cantidades por plato agrupadas por pase.'
      : 'Requiere escandallo.',
    enlace: `/api/cocina/event/${eventId}/production`,
  });

  // PRE/DÍA — 5. Hoja de Carga (SOLO externo)
  fases.push({
    key: 'carga', titulo: 'Hoja de Carga de la furgoneta (por pase y unidades)', momento: 'dia',
    aplica: esExterno,
    motivo_no_aplica: esExterno ? undefined : 'El evento es en el local: no hay transporte de comida.',
    estado: !esExterno ? 'no_aplica' : hayEscandallo ? 'listo' : 'bloqueado',
    resumen: !esExterno
      ? 'No aplica — evento en Salones Benítez.'
      : hayEscandallo ? 'Carga dividida por pase y unidades para el desplazamiento.'
      : 'Requiere escandallo.',
    enlace: `/api/cocina/event/${eventId}/loading`,
  });

  // PRE/DÍA — 6. Hoja Logística (equipamiento + seco) — contenido según venue
  fases.push({
    key: 'logistica', titulo: 'Hoja Logística (equipamiento + producto seco)', momento: 'dia',
    aplica: true,
    estado: hayEscandallo ? 'listo' : 'bloqueado',
    resumen: esExterno
      ? 'Incluye TRANSPORTE de equipamiento (freidoras, bandejas, menaje) + producto seco.'
      : 'Solo producto seco y consumibles — el equipamiento ya está en el local.',
    detalle: { incluye_equipamiento: esExterno },
    enlace: `/api/cocina/event/${eventId}/logistics`,
  });

  // PRE — 7. Sitting / mapa de mesas — plano propio vs PDF externo
  const sittingListo = esExterno ? !!ev.venue_pdf_url : true;
  fases.push({
    key: 'sitting', titulo: 'Sitting y mapa de mesas', momento: 'pre',
    aplica: true,
    estado: sittingListo ? 'listo' : 'pendiente',
    resumen: esExterno
      ? (ev.venue_pdf_url ? 'Plano del venue externo cargado; sitting sobre ese plano.'
         : 'Subir el PDF/plano del venue externo para montar el sitting.')
      : 'Plano de Salones Benítez (editor propio).',
    detalle: { requiere_pdf: esExterno, plano_pdf: ev.venue_pdf_url || null },
    enlace: esExterno ? `/admin/mapa-mesas?event=${eventId}` : `/admin/mapa-mesas?event=${eventId}`,
  });

  // POST — 8. Escandallo real (consumo) + desviación
  fases.push({
    key: 'escandallo_real', titulo: 'Escandallo real y desviación teórico↔real', momento: 'post',
    aplica: true,
    estado: congelado ? 'listo' : completado ? 'pendiente' : 'bloqueado',
    resumen: congelado
      ? `Congelado. Coste real ${costeReal.toFixed(2)} € vs estimado ${costeEst.toFixed(2)} € (desv. ${money(costeReal - costeEst).toFixed(2)} €).`
      : completado ? 'Registrar consumos reales y congelar.'
      : 'Disponible tras realizar el evento.',
    detalle: { coste_estimado: costeEst, coste_real: costeReal, desviacion: money(costeReal - costeEst), congelado },
    enlace: `/api/escandallo/${eventId}`,
  });

  // POST — 9. Inventario (deducción de stock real)
  fases.push({
    key: 'inventario', titulo: 'Inventario: deducción de stock consumido', momento: 'post',
    aplica: true,
    estado: ev.stock_deducted ? 'listo' : completado ? 'pendiente' : 'bloqueado',
    resumen: ev.stock_deducted ? 'Stock deducido del inventario al cerrar el evento.'
      : completado ? 'Pendiente de deducir stock.' : 'Disponible tras realizar el evento.',
    enlace: `/api/stock/deduct`,
  });

  // POST — 10. Trazabilidad (lotes consumidos)
  fases.push({
    key: 'trazabilidad', titulo: 'Trazabilidad sanitaria (lotes del lote al plato)', momento: 'post',
    aplica: true,
    estado: lotes > 0 ? 'listo' : completado ? 'pendiente' : 'bloqueado',
    resumen: lotes > 0 ? `${lotes} lote(s) trazados para inspección.`
      : 'Sin lotes registrados — requisito de inspección sanitaria.',
    enlace: `/api/trazabilidad/trace/${eventId}`,
  });

  // POST — 11. Coste real y cierre (factura)
  fases.push({
    key: 'cierre', titulo: 'Cierre: coste real y facturación', momento: 'post',
    aplica: true,
    estado: facturaHecha ? 'listo' : completado ? 'pendiente' : 'bloqueado',
    resumen: facturaHecha ? 'Evento cerrado y facturado.'
      : completado ? 'Pendiente de generar la factura.' : 'Disponible tras realizar el evento.',
    enlace: `/api/events/${eventId}/close`,
  });

  const aplicables = fases.filter(f => f.aplica);
  const completadas = aplicables.filter(f => f.estado === 'listo').length;

  return {
    evento: {
      id: ev.id, nombre: ev.client_name, fecha: ev.event_date,
      pax: ops.pax, adultos, ninos, serviceType, estado: ev.status,
    },
    venue: {
      tipo: venue, etiqueta: VENUE_LABEL[venue], es_externo: esExterno,
      ubicacion: ev.location || null, plano_pdf: ev.venue_pdf_url || null,
      nota: esExterno
        ? 'Catering desplazado: añade Hoja de Carga, transporte de equipamiento y sitting sobre el plano del venue.'
        : 'Evento en el local: sin transporte de comida; el equipamiento ya está en cocina.',
    },
    escandallo: { lineas, coste_estimado: costeEst, coste_real: costeReal, congelado },
    fases,
    progreso: {
      aplicables: aplicables.length,
      completadas,
      pct: aplicables.length ? Math.round((completadas / aplicables.length) * 100) : 0,
    },
  };
}
