/**
 * EventFlow — Autenticación de endpoints cron (FR-A12 y crons en general)
 *
 * Los crons son públicos a nivel de middleware (los dispara un scheduler externo),
 * así que la protección vive aquí: si `CRON_SECRET` está configurado, exige
 * `Authorization: Bearer <secret>` o cabecera `x-cron-secret`. En desarrollo, si
 * no hay secreto configurado, se permite (para pruebas locales).
 */
import type { NextRequest } from 'next/server';

export function isCronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Sin secreto configurado: permitir solo fuera de producción.
    return process.env.NODE_ENV !== 'production';
  }
  const auth = request.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  if (request.headers.get('x-cron-secret') === secret) return true;
  // Vercel Cron firma con esta cabecera.
  if (request.headers.get('x-vercel-cron')) return true;
  return false;
}
