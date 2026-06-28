/**
 * EventFlow — RBAC (control de acceso por perfil)  ·  FR-R01…R04
 *
 * Fuente ÚNICA de la matriz de permisos. La consumen:
 *   - `middleware.ts` (enforcement en servidor: 403 en API) — capa principal
 *   - las rutas más sensibles (admin/users…) verifican además con `@/lib/authz`
 *     (defensa en profundidad)
 *   - `AdminLayout` (construye el menú según el perfil)
 *
 * Módulo puro (sin dependencias de Node) para poder ejecutarse en el Edge runtime.
 *
 * Regla de oro (FR-R02): ocultar en UI **y** validar en cada API. Esconder el
 * botón no basta.
 */

export const ROLES = ['admin', 'cocina', 'camareros', 'clientes'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administración',
  cocina: 'Gestión cocina',
  camareros: 'Gestión camareros (maître)',
  clientes: 'Gestión clientes (comercial)',
};

export function isRole(v: unknown): v is Role {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v);
}

/** Normaliza un rol desconocido/heredado a uno válido (default: admin para no romper). */
export function normalizeRole(v: unknown): Role {
  return isRole(v) ? v : 'admin';
}

// ============================================================
// Enforcement de API (servidor)
// ============================================================

/**
 * Reglas de acceso a la API. Para cada prefijo, qué roles pueden usarlo.
 * `admin` siempre tiene acceso total (no hace falta listarlo).
 * Gana el prefijo MÁS LARGO que casa; si nada casa → solo admin.
 *
 * Los prefijos más específicos (p. ej. `/api/staffing/pay`) deben poder ganar
 * a los generales (`/api/staffing`): el match elige el prefijo más largo.
 */
interface ApiRule { prefix: string; roles: Role[] }

const API_RULES: ApiRule[] = [
  // Comercial (clientes)
  { prefix: '/api/quotes', roles: ['clientes'] },
  { prefix: '/api/leads', roles: ['clientes'] },
  { prefix: '/api/clients', roles: ['clientes'] },
  { prefix: '/api/appointments', roles: ['clientes'] },

  // Finanzas / billing — comercial + admin (cocina y camareros NO)
  { prefix: '/api/invoices', roles: ['clientes'] },
  { prefix: '/api/billing', roles: ['clientes'] },
  { prefix: '/api/payments', roles: ['clientes'] },
  { prefix: '/api/cobros', roles: ['clientes'] },

  // Cocina & catering
  { prefix: '/api/cocina', roles: ['cocina'] },
  { prefix: '/api/escandallo', roles: ['cocina'] },
  { prefix: '/api/stock', roles: ['cocina'] },
  { prefix: '/api/trazabilidad', roles: ['cocina'] },
  { prefix: '/api/appcc', roles: ['cocina'] },
  { prefix: '/api/providers', roles: ['cocina'] },
  { prefix: '/api/recipes', roles: ['cocina'] },

  // Sala / camareros
  { prefix: '/api/staffing/pay', roles: [] },          // nóminas → solo admin
  { prefix: '/api/staffing', roles: ['camareros'] },
  { prefix: '/api/floor-plan', roles: ['camareros'] },
  { prefix: '/api/mapa-mesas', roles: ['camareros'] },
  { prefix: '/api/tables', roles: ['camareros'] },
  { prefix: '/api/plans', roles: ['camareros'] },
  { prefix: '/api/guests', roles: ['camareros', 'clientes'] },
  { prefix: '/api/guest-forms', roles: ['camareros', 'clientes'] },
  { prefix: '/api/briefing', roles: ['camareros'] },

  // Compartidos (lectura/datos del evento) — todos los perfiles internos
  { prefix: '/api/catalog', roles: ['cocina', 'clientes'] },
  { prefix: '/api/events', roles: ['cocina', 'camareros', 'clientes'] },
  { prefix: '/api/event-orders', roles: ['cocina', 'camareros'] },
  { prefix: '/api/event-flow', roles: ['cocina', 'camareros'] },
  { prefix: '/api/generate-operations', roles: ['cocina', 'camareros'] },
  { prefix: '/api/hoja-operacion', roles: ['cocina', 'camareros'] },

  // Sub-rutas finanzas/comercial bajo /api/events/:id (gana al prefijo /api/events).
  { prefix: '/api/events/:id/gastos-previos', roles: ['clientes'] },

  // Falsos bloqueos detectados (nav los muestra a no-admin) → reglas explícitas.
  { prefix: '/api/checklist', roles: ['camareros'] },        // checklist día D
  { prefix: '/api/shopping', roles: ['cocina'] },            // lista de la compra
  { prefix: '/api/waiters', roles: ['camareros'] },          // alta/listado camareros
  { prefix: '/api/guest-menus', roles: ['camareros', 'clientes'] },

  // Solo admin
  { prefix: '/api/admin/users', roles: [] },
];

/** Normaliza segmentos dinámicos (UUID/numéricos) a `:id` para casar reglas. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function normalizePath(pathname: string): string {
  const clean = pathname.split('?')[0];
  return clean.split('/').map((seg) => (UUID_RE.test(seg) || /^\d+$/.test(seg) ? ':id' : seg)).join('/');
}

/** ¿Puede `role` invocar este endpoint? `admin` siempre sí. */
export function canAccessApi(role: Role, pathname: string): boolean {
  if (role === 'admin') return true;
  const path = normalizePath(pathname);
  // prefijo (normalizado) más largo que casa
  let best: ApiRule | null = null;
  for (const r of API_RULES) {
    if (path === r.prefix || path.startsWith(r.prefix + '/')) {
      if (!best || r.prefix.length > best.prefix.length) best = r;
    }
  }
  if (!best) return false; // por defecto: solo admin
  return best.roles.includes(role);
}

// ============================================================
// Navegación (UI) — qué módulos ve cada perfil
// ============================================================

/** Roles permitidos por id de item de menú (alineado con AdminLayout). */
export const NAV_ROLES: Record<string, Role[]> = {
  // Panel
  dashboard: ['admin', 'cocina', 'camareros', 'clientes'],
  // Captación (comercial)
  leads: ['admin', 'clientes'],
  kanban: ['admin', 'clientes'],
  clientes: ['admin', 'clientes'],
  // Planificación
  agenda: ['admin', 'clientes', 'camareros'],
  checklist: ['admin', 'camareros'],
  fichaEvento: ['admin', 'cocina', 'camareros', 'clientes'],
  // Evento
  catalog: ['admin', 'cocina', 'clientes'],
  operations: ['admin', 'cocina', 'camareros'],
  'mapa-mesas': ['admin', 'camareros'],
  ocupacion: ['admin', 'camareros'],
  rentabilidad: ['admin'],                         // margen/coste comercial
  invitados: ['admin', 'camareros', 'clientes'],
  confirmacion: ['admin', 'camareros'],
  // Cocina
  cocina: ['admin', 'cocina'],
  // Staffing
  staffing: ['admin', 'camareros'],
  // Stock & proveedores
  stock: ['admin', 'cocina'],
  proveedores: ['admin', 'cocina'],
  trazabilidad: ['admin', 'cocina'],
  // Finanzas
  cobros: ['admin', 'clientes'],
  // Config (solo admin: gestión de usuarios/roles)
  config: ['admin'],
};

/** ¿Ve `role` este item de menú? Por defecto (item no listado) → solo admin. */
export function canSeeNav(role: Role, itemId: string): boolean {
  if (role === 'admin') return true;
  const roles = NAV_ROLES[itemId];
  return roles ? roles.includes(role) : false;
}

/** Página de /admin a la que redirigir a cada rol tras login (su "home"). */
export const ROLE_HOME: Record<Role, string> = {
  admin: '/admin',
  cocina: '/admin/cocina',
  camareros: '/admin/staffing',
  clientes: '/admin/kanban',
};
