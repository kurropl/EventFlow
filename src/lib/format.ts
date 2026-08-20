/**
 * EventFlow — Formato compartido (ES-es)
 *
 * Centraliza el formato de moneda/fecha que antes se repetía inline en
 * decenas de páginas (Intl.NumberFormat es-ES). SALIDA IDÉNTICA a la
 * original para no cambiar el aspecto visual: "1.234,56 €" (coma decimal,
 * espacio antes de €, punto de millar).
 *
 * NOTA: NO sustituye a formatMoney de units-pure (que usa punto decimal +
 * espacio "1,234.56 €"). Este helper es para los sitios que ya usaban el
 * Formato es-ES del Intl y que NO deben cambiar de aspecto.
 */

const EUR_FORMATTER = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
});

/** Formatea un número/string a moneda es-ES ("1.234,56 €"). */
export function formatEUR(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (n === null || n === undefined || Number.isNaN(n)) return EUR_FORMATTER.format(0);
  return EUR_FORMATTER.format(n);
}

/** Formatea una fecha ISO a dd/mm/yyyy (es-ES). */
export function formatDate(
  value: string | Date | null | undefined,
  opts?: Intl.DateTimeFormatOptions
): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-ES', opts);
}