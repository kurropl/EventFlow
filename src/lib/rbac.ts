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
 *
 * Matriz de 7 roles (NR-3): Admin, Gerente, Analista, Jefe Cocina, Cocinero,
 * Maitre, Camarero. Los roles legacy (`cocina`, `camareros`, `clientes`) se
 * normalizan a `admin` para no romper sesiones existentes.
 */

export const ROLES = ['admin', 'jefe-cocina', 'cocinero', 'maitre', 'camarero', 'gerente', 'analista'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administración',
  'jefe-cocina': 'Jefe de Cocina',
  cocinero: 'Cocinero',
  maitre: 'Maitre',
  camarero: 'Camarero',
  gerente: 'Gerencia',
  analista: 'Analista',
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
  // Comercial (gerente/analista)
  { prefix: '/api/quotes', roles: ['gerente', 'analista'] },
  { prefix: '/api/leads', roles: ['gerente', 'analista'] },
  { prefix: '/api/clients', roles: ['gerente', 'analista'] },
  { prefix: '/api/appointments', roles: ['gerente', 'analista'] },

  // Finanzas / billing — gerencia + analista (cocina y sala NO)
  { prefix: '/api/invoices', roles: ['gerente', 'analista'] },
  { prefix: '/api/billing', roles: ['gerente', 'analista'] },
  { prefix: '/api/payments', roles: ['gerente', 'analista'] },
  { prefix: '/api/cobros', roles: ['gerente', 'analista'] },

  // Cocina & catering
  { prefix: '/api/cocina', roles: ['jefe-cocina', 'cocinero'] },
  { prefix: '/api/escandallo', roles: ['jefe-cocina', 'analista'] },
  { prefix: '/api/stock', roles: ['jefe-cocina'] },
  { prefix: '/api/trazabilidad', roles: ['jefe-cocina'] },
  { prefix: '/api/appcc', roles: ['jefe-cocina'] },
  { prefix: '/api/providers', roles: ['jefe-cocina'] },
  { prefix: '/api/recipes', roles: ['jefe-cocina', 'cocinero'] },

  // Sala / camareros
  { prefix: '/api/staffing/pay', roles: [] },          // nóminas → solo admin
  { prefix: '/api/staffing', roles: ['maitre'] },
  { prefix: '/api/floor-plan', roles: ['maitre', 'camarero'] },
  { prefix: '/api/mapa-mesas', roles: ['maitre', 'camarero'] },
  { prefix: '/api/tables', roles: ['maitre', 'camarero'] },
  { prefix: '/api/plans', roles: ['maitre', 'camarero'] },
  { prefix: '/api/guests', roles: ['maitre', 'gerente'] },
  { prefix: '/api/guest-forms', roles: ['maitre', 'camarero'] },
  { prefix: '/api/briefing', roles: ['maitre', 'camarero'] },

  // Compartidos (lectura/datos del evento) — perfiles de planificación
  { prefix: '/api/catalog', roles: ['jefe-cocina', 'gerente', 'analista'] },
  { prefix: '/api/events', roles: ['jefe-cocina', 'maitre', 'cocinero', 'gerente'] },
  { prefix: '/api/event-orders', roles: ['jefe-cocina', 'cocinero', 'maitre', 'camarero'] },
  { prefix: '/api/event-flow', roles: ['jefe-cocina', 'cocinero', 'maitre', 'camarero'] },
  { prefix: '/api/generate-operations', roles: ['jefe-cocina', 'cocinero', 'maitre', 'camarero'] },
  { prefix: '/api/hoja-operacion', roles: ['jefe-cocina', 'cocinero', 'maitre', 'camarero'] },

  // Sub-rutas finanzas/comercial bajo /api/events/:id (gana al prefijo /api/events).
  { prefix: '/api/events/:id/gastos-previos', roles: ['gerente', 'analista'] },

  // Falsos bloqueos detectados (nav los muestra a no-admin) → reglas explícitas.
  { prefix: '/api/checklist', roles: ['maitre', 'camarero'] },        // checklist día D
  { prefix: '/api/shopping', roles: ['jefe-cocina'] },                // lista de la compra
  { prefix: '/api/waiters', roles: ['maitre', 'camarero'] },          // alta/listado camareros
  { prefix: '/api/guest-menus', roles: ['maitre', 'camarero'] },
  { prefix: '/api/analytics', roles: ['analista', 'gerente'] },

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
  dashboard: ['admin', 'jefe-cocina', 'cocinero', 'maitre', 'camarero', 'gerente', 'analista'],
  // Captación (gerencia/analista)
  leads: ['admin', 'gerente', 'analista'],
  kanban: ['admin', 'gerente', 'analista'],
  clientes: ['admin', 'gerente', 'analista'],
  // Planificación
  agenda: ['admin', 'gerente', 'analista', 'jefe-cocina', 'maitre', 'cocinero'],
  checklist: ['admin', 'maitre', 'camarero'],
  fichaEvento: ['admin', 'gerente', 'analista', 'jefe-cocina', 'maitre', 'cocinero'],
  // Evento
  catalog: ['admin', 'gerente', 'analista', 'jefe-cocina', 'cocinero'],
  operations: ['admin', 'jefe-cocina', 'cocinero', 'maitre', 'camarero'],
  'mapa-mesas': ['admin', 'maitre', 'camarero'],
  ocupacion: ['admin', 'maitre', 'camarero'],
  rentabilidad: ['admin', 'gerente', 'analista'],          // margen/coste comercial
  invitados: ['admin', 'gerente', 'maitre'],
  confirmacion: ['admin', 'maitre', 'camarero'],
  // Cocina — subapartados (Jefe Cocina ve todo, Cocinero parcial)
  cocina: ['admin', 'jefe-cocina', 'cocinero'],
  recetas: ['admin', 'jefe-cocina', 'cocinero'],
  escandallos: ['admin', 'jefe-cocina'],
  produccion: ['admin', 'jefe-cocina', 'cocinero'],
  carga: ['admin', 'jefe-cocina'],
  logistica: ['admin', 'jefe-cocina'],
  appcc: ['admin', 'jefe-cocina'],
  compras: ['admin', 'jefe-cocina', 'gerente'],
  // Staffing
  staffing: ['admin', 'maitre'],
  // Stock & proveedores
  stock: ['admin', 'jefe-cocina'],
  proveedores: ['admin', 'jefe-cocina'],
  trazabilidad: ['admin', 'jefe-cocina'],
  // Finanzas
  cobros: ['admin', 'gerente', 'analista'],
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
  'jefe-cocina': '/admin/cocina',
  cocinero: '/admin/cocina/produccion',
  maitre: '/admin/agenda',
  camarero: '/admin/staffing',
  gerente: '/admin',
  analista: '/admin',
};
