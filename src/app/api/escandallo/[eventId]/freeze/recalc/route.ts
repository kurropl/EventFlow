/**
 * POST /api/escandallo/[eventId]/freeze/recalc — Recalcular escandallo
 *
 * El botón "Recalcular escandallo" de EventDetail.tsx llama a esta ruta,
 * que antes no existía como archivo real (Next.js no matchea subrutas
 * dinámicas sin su propio route.ts) y devolvía 404. La lógica de recalc
 * ya vivía en freeze/route.ts, que distingue freeze/recalc mirando si el
 * pathname termina en `/freeze` — al reexportar el mismo handler aquí, la
 * misma comprobación cae correctamente en la rama `recalc`.
 */
export { POST } from '../route';
