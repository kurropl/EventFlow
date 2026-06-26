/**
 * EventFlow — Verificación de rol en el handler (defensa en profundidad)
 *
 * El middleware ya aplica RBAC, pero las rutas más sensibles (gestión de usuarios,
 * nóminas) verifican también aquí, por si el middleware se saltara en un refactor.
 * Runtime Node (usa verifyToken con jsonwebtoken).
 */
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { isRole, type Role } from '@/lib/rbac';

/** Rol del usuario de la petición (del JWT verificado), o null si no hay/!válido. */
export function requestRole(request: NextRequest): Role | null {
  const token = request.cookies.get('eventflow_token')?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || !isRole(user.role)) return null;
  return user.role;
}

/** true si el usuario de la petición tiene alguno de los roles indicados. */
export function hasRole(request: NextRequest, ...roles: Role[]): boolean {
  const r = requestRole(request);
  return r !== null && roles.includes(r);
}
