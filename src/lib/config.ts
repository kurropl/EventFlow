/**
 * EventFlow — Centralized configuration
 *
 * Single source of truth for secrets and credentials.
 * Fails fast at startup if critical env vars are missing.
 */

const JWT_SECRET_FALLBACK = 'eventflow-dev-secret-DO-NOT-USE-IN-PRODUCTION';

export function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Fail-closed en producción: un secreto por defecto (y público en el repo)
    // permitiría forjar tokens admin. Abortamos en vez de degradar.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[config] FATAL: JWT_SECRET no está configurado en producción. Aborta.');
    }
    return JWT_SECRET_FALLBACK;
  }
  return secret;
}

interface AdminCredentials {
  username: string;
  password: string;
}

export function getAdminCredentials(): AdminCredentials {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[config] FATAL: ADMIN_PASSWORD is not set. Login will fail.');
    }
    return { username, password: '' };
  }
  return { username, password };
}
