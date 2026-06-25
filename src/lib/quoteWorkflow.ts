/**
 * EventFlow — Workflow de presupuestos (4 fases visibles)  ·  FR-A01…A04
 *
 * El negocio ve UN único flujo de 4 fases: borrador → 1º contacto → aceptado →
 * realizado (+ descartado). Internamente el estado del presupuesto/evento sigue
 * en su forma técnica (draft/sent/accepted/…) para no romper integraciones; aquí
 * está el ÚNICO mapeo a las fases visibles y las reglas de la UI.
 */

export type QuotePhase = 'borrador' | 'contacto' | 'aceptado' | 'realizado' | 'descartado';

export const PHASE_LABEL: Record<QuotePhase, string> = {
  borrador: 'Borrador',
  contacto: '1º contacto',
  aceptado: 'Aceptado',
  realizado: 'Realizado',
  descartado: 'Descartado',
};

/** Las 4 fases activas del tablero (en orden) + la columna de descartados. */
export const ACTIVE_PHASES: QuotePhase[] = ['borrador', 'contacto', 'aceptado', 'realizado'];

/** Mapea un estado técnico (quote o evento) a su fase visible. */
export function toPhase(status: string | null | undefined): QuotePhase {
  switch ((status || '').toLowerCase()) {
    case 'draft':
    case 'historical':
    case 'nuevo':
    case 'borrador':
      return 'borrador';
    case 'sent':
    case 'propuesta_enviada':
    case 'contacto':
      return 'contacto';
    case 'accepted':
    case 'confirmado':
    case 'in_progress':
    case 'en_curso':
    case 'aceptado':
      return 'aceptado';
    case 'completed':
    case 'completado':
    case 'paid':
    case 'pagado':
    case 'realizado':
      return 'realizado';
    case 'rejected':
    case 'cancelled':
    case 'expired':
    case 'lost':
    case 'rechazado':
    case 'descartado':
      return 'descartado';
    default:
      return 'borrador';
  }
}

/** Estados técnicos que representan un presupuesto ya aceptado. */
export function isAccepted(status: string | null | undefined): boolean {
  return toPhase(status) === 'aceptado' || toPhase(status) === 'realizado';
}

/** Estados técnicos que cuentan como cancelación/rechazo. */
export function isCancellation(status: string | null | undefined): boolean {
  const s = (status || '').toLowerCase();
  return ['rejected', 'cancelled', 'lost', 'rechazado', 'descartado'].includes(s);
}

/**
 * ¿Se puede cancelar este presupuesto? (FR-A04: en aceptado NO se muestra/permite).
 * Una vez aceptado se gestiona por incidencia/realizado, no por cancelación.
 */
export function canCancel(status: string | null | undefined): boolean {
  const phase = toPhase(status);
  return phase === 'borrador' || phase === 'contacto';
}

/**
 * En borrador solo son editables el precio final y el nº de comensales; el
 * desglose por líneas queda oculto (FR-A02).
 */
export function canEditOnlyPriceAndGuests(status: string | null | undefined): boolean {
  return toPhase(status) === 'borrador';
}
