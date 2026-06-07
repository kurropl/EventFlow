/**
 * EventFlow — Shared formatting utilities
 */

/** Format a number as Spanish Euro currency: 1.234 € */
export function money(n: number | string | null | undefined): string {
  const num = Number(n) || 0;
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
    useGrouping: 'always',
  }).format(num);
}

/** Format a number as Spanish Euro with decimals: 1.234,50 € */
export function moneyDecimals(n: number | string | null | undefined): string {
  const num = Number(n) || 0;
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/** Format a number with Spanish grouping: 1.234 */
export function num(n: number | string | null | undefined): string {
  return new Intl.NumberFormat('es-ES', { useGrouping: 'always' }).format(Number(n) || 0);
}
