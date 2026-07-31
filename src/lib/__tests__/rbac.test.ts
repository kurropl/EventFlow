import { describe, it, expect } from 'vitest';
import {
  ROLES,
  type Role,
  isRole,
  normalizeRole,
  canAccessApi,
  canSeeNav,
  ROLE_HOME,
} from '@/lib/rbac';

/* ================================================================= */
/*  FASE 1 — TDD: RBAC con 7 roles                                  */
/* ================================================================= */

describe('Fase 1 — RBAC: Roles y tipos', () => {
  it('debe tener exactamente 7 roles', () => {
    expect(ROLES).toHaveLength(7);
  });

  it('debe incluir los 7 roles definidos', () => {
    expect(ROLES).toContain('admin');
    expect(ROLES).toContain('jefe-cocina');
    expect(ROLES).toContain('cocinero');
    expect(ROLES).toContain('maitre');
    expect(ROLES).toContain('camarero');
    expect(ROLES).toContain('gerente');
    expect(ROLES).toContain('analista');
  });

  it('isRole valida correctamente', () => {
    expect(isRole('admin')).toBe(true);
    expect(isRole('jefe-cocina')).toBe(true);
    expect(isRole('cocinero')).toBe(true);
    expect(isRole('maitre')).toBe(true);
    expect(isRole('camarero')).toBe(true);
    expect(isRole('gerente')).toBe(true);
    expect(isRole('analista')).toBe(true);
    expect(isRole('cocina')).toBe(false); // legacy
    expect(isRole('camareros')).toBe(false); // legacy
    expect(isRole('inexistente')).toBe(false);
    expect(isRole(undefined)).toBe(false);
    expect(isRole(null)).toBe(false);
  });

  it('normalizeRole cae a admin para valores inválidos', () => {
    expect(normalizeRole('admin')).toBe('admin');
    expect(normalizeRole('jefe-cocina')).toBe('jefe-cocina');
    expect(normalizeRole('inexistente')).toBe('admin');
    expect(normalizeRole('cocina')).toBe('admin'); // legacy
    expect(normalizeRole(undefined)).toBe('admin');
    expect(normalizeRole(null)).toBe('admin');
  });
});

describe('Fase 1 — ROLE_HOME correcto', () => {
  it('cada rol tiene una home page', () => {
    for (const role of ROLES) {
      expect(ROLE_HOME[role]).toBeDefined();
      expect(ROLE_HOME[role]).toMatch(/^\/admin/);
    }
  });

  it('admin va a /admin', () => expect(ROLE_HOME.admin).toBe('/admin'));
  it('jefe-cocina va a /admin/cocina', () => expect(ROLE_HOME['jefe-cocina']).toBe('/admin/cocina'));
  it('cocinero va a /admin/cocina/produccion', () => expect(ROLE_HOME.cocinero).toBe('/admin/cocina/produccion'));
  it('maitre va a /admin/agenda', () => expect(ROLE_HOME.maitre).toBe('/admin/agenda'));
  it('camarero va a /admin/staffing', () => expect(ROLE_HOME.camarero).toBe('/admin/staffing'));
  it('gerente va a /admin', () => expect(ROLE_HOME.gerente).toBe('/admin'));
  it('analista va a /admin', () => expect(ROLE_HOME.analista).toBe('/admin'));
});

describe('Fase 1 — NAV_ROLES: permisos de navegación', () => {
  /* ===== Panel ===== */
  it('dashboard visible para todos', () => {
    for (const r of ROLES) expect(canSeeNav(r, 'dashboard')).toBe(true);
  });

  /* ===== Captación: solo admin, gerente, analista ===== */
  it('leads solo admin/gerente/analista', () => {
    expect(canSeeNav('admin', 'leads')).toBe(true);
    expect(canSeeNav('gerente', 'leads')).toBe(true);
    expect(canSeeNav('analista', 'leads')).toBe(true);
    expect(canSeeNav('jefe-cocina', 'leads')).toBe(false);
    expect(canSeeNav('cocinero', 'leads')).toBe(false);
    expect(canSeeNav('maitre', 'leads')).toBe(false);
    expect(canSeeNav('camarero', 'leads')).toBe(false);
  });

  /* ===== Planificación: todos menos camarero base ===== */
  it('agenda visible para planificadores pero no camarero', () => {
    expect(canSeeNav('admin', 'agenda')).toBe(true);
    expect(canSeeNav('gerente', 'agenda')).toBe(true);
    expect(canSeeNav('analista', 'agenda')).toBe(true);
    expect(canSeeNav('jefe-cocina', 'agenda')).toBe(true);
    expect(canSeeNav('maitre', 'agenda')).toBe(true);
    expect(canSeeNav('cocinero', 'agenda')).toBe(true);
    expect(canSeeNav('camarero', 'agenda')).toBe(false);
  });

  /* ===== Sala ===== */
  it('mapa-mesas visible para admin/maitre/camarero', () => {
    expect(canSeeNav('admin', 'mapa-mesas')).toBe(true);
    expect(canSeeNav('maitre', 'mapa-mesas')).toBe(true);
    expect(canSeeNav('camarero', 'mapa-mesas')).toBe(true);
    expect(canSeeNav('cocinero', 'mapa-mesas')).toBe(false);
  });

  it('ocupacion visible para admin/maitre/camarero', () => {
    expect(canSeeNav('admin', 'ocupacion')).toBe(true);
    expect(canSeeNav('maitre', 'ocupacion')).toBe(true);
    expect(canSeeNav('camarero', 'ocupacion')).toBe(true);
    expect(canSeeNav('cocinero', 'ocupacion')).toBe(false);
  });

  it('invitados visible para admin/gerente/maitre', () => {
    expect(canSeeNav('admin', 'invitados')).toBe(true);
    expect(canSeeNav('gerente', 'invitados')).toBe(true);
    expect(canSeeNav('maitre', 'invitados')).toBe(true);
    expect(canSeeNav('camarero', 'invitados')).toBe(false);
    expect(canSeeNav('cocinero', 'invitados')).toBe(false);
  });

  /* ===== Cocina: Jefe Cocina ve todo, Cocinero parcial ===== */
  it('cocina (módulo) visible para admin/jefe-cocina/cocinero', () => {
    expect(canSeeNav('admin', 'cocina')).toBe(true);
    expect(canSeeNav('jefe-cocina', 'cocina')).toBe(true);
    expect(canSeeNav('cocinero', 'cocina')).toBe(true);
    expect(canSeeNav('camarero', 'cocina')).toBe(false);
  });

  it('recetas visible para admin/jefe-cocina/cocinero', () => {
    expect(canSeeNav('admin', 'recetas')).toBe(true);
    expect(canSeeNav('jefe-cocina', 'recetas')).toBe(true);
    expect(canSeeNav('cocinero', 'recetas')).toBe(true);
  });

  it('escandallos visible solo para admin/jefe-cocina (NO cocinero)', () => {
    expect(canSeeNav('admin', 'escandallos')).toBe(true);
    expect(canSeeNav('jefe-cocina', 'escandallos')).toBe(true);
    expect(canSeeNav('cocinero', 'escandallos')).toBe(false);
  });

  it('appcc visible solo para admin/jefe-cocina (NO cocinero)', () => {
    expect(canSeeNav('admin', 'appcc')).toBe(true);
    expect(canSeeNav('jefe-cocina', 'appcc')).toBe(true);
    expect(canSeeNav('cocinero', 'appcc')).toBe(false);
  });

  it('logistica visible solo para admin/jefe-cocina (NO cocinero)', () => {
    expect(canSeeNav('admin', 'logistica')).toBe(true);
    expect(canSeeNav('jefe-cocina', 'logistica')).toBe(true);
    expect(canSeeNav('cocinero', 'logistica')).toBe(false);
  });

  it('carga visible solo para admin/jefe-cocina (NO cocinero)', () => {
    expect(canSeeNav('admin', 'carga')).toBe(true);
    expect(canSeeNav('jefe-cocina', 'carga')).toBe(true);
    expect(canSeeNav('cocinero', 'carga')).toBe(false);
  });

  it('produccion visible para admin/jefe-cocina/cocinero', () => {
    expect(canSeeNav('admin', 'produccion')).toBe(true);
    expect(canSeeNav('jefe-cocina', 'produccion')).toBe(true);
    expect(canSeeNav('cocinero', 'produccion')).toBe(true);
  });

  /* ===== Staffing ===== */
  it('staffing visible para admin/maitre', () => {
    expect(canSeeNav('admin', 'staffing')).toBe(true);
    expect(canSeeNav('maitre', 'staffing')).toBe(true);
    expect(canSeeNav('camarero', 'staffing')).toBe(false);
  });

  /* ===== Finanzas ===== */
  it('cobros visible para admin/gerente/analista', () => {
    expect(canSeeNav('admin', 'cobros')).toBe(true);
    expect(canSeeNav('gerente', 'cobros')).toBe(true);
    expect(canSeeNav('analista', 'cobros')).toBe(true);
    expect(canSeeNav('camarero', 'cobros')).toBe(false);
  });

  it('rentabilidad visible para admin/gerente/analista', () => {
    expect(canSeeNav('admin', 'rentabilidad')).toBe(true);
    expect(canSeeNav('gerente', 'rentabilidad')).toBe(true);
    expect(canSeeNav('analista', 'rentabilidad')).toBe(true);
    expect(canSeeNav('camarero', 'rentabilidad')).toBe(false);
  });

  /* ===== Config ===== */
  it('config visible solo para admin', () => {
    expect(canSeeNav('admin', 'config')).toBe(true);
    for (const r of ROLES) {
      if (r !== 'admin') expect(canSeeNav(r, 'config')).toBe(false);
    }
  });
});

describe('Fase 1 — canAccessApi: reglas de API', () => {
  /* ===== Solo admin ===== */
  it('/api/admin/users solo admin', () => {
    expect(canAccessApi('admin', '/api/admin/users')).toBe(true);
    expect(canAccessApi('gerente', '/api/admin/users')).toBe(false);
    expect(canAccessApi('jefe-cocina', '/api/admin/users')).toBe(false);
  });

  /* ===== Cocina API ===== */
  it('/api/cocina/* accesible para admin/jefe-cocina', () => {
    expect(canAccessApi('admin', '/api/cocina/recetas')).toBe(true);
    expect(canAccessApi('jefe-cocina', '/api/cocina/recetas')).toBe(true);
    expect(canAccessApi('cocinero', '/api/cocina/recetas')).toBe(true);
    expect(canAccessApi('maitre', '/api/cocina/recetas')).toBe(false);
  });

  it('/api/escandallo/* accesible para admin/jefe-cocina/analista', () => {
    expect(canAccessApi('admin', '/api/escandallo/generate')).toBe(true);
    expect(canAccessApi('jefe-cocina', '/api/escandallo/generate')).toBe(true);
    expect(canAccessApi('analista', '/api/escandallo/generate')).toBe(true);
    expect(canAccessApi('cocinero', '/api/escandallo/generate')).toBe(false);
  });

  /* ===== Sala ===== */
  it('/api/mapa-mesas accesible para admin/maitre/camarero', () => {
    expect(canAccessApi('admin', '/api/mapa-mesas')).toBe(true);
    expect(canAccessApi('maitre', '/api/mapa-mesas')).toBe(true);
    expect(canAccessApi('camarero', '/api/mapa-mesas')).toBe(true);
    expect(canAccessApi('jefe-cocina', '/api/mapa-mesas')).toBe(false);
  });

  it('/api/staffing/pay solo admin (ni maitre)', () => {
    expect(canAccessApi('admin', '/api/staffing/pay')).toBe(true);
    expect(canAccessApi('maitre', '/api/staffing/pay')).toBe(false);
    expect(canAccessApi('camarero', '/api/staffing/pay')).toBe(false);
  });

  it('/api/staffing (no pay) accesible para admin/maitre', () => {
    expect(canAccessApi('admin', '/api/staffing')).toBe(true);
    expect(canAccessApi('maitre', '/api/staffing')).toBe(true);
    expect(canAccessApi('camarero', '/api/staffing')).toBe(false);
  });

  /* ===== Finanzas ===== */
  it('/api/cobros accesible para admin/gerente/analista', () => {
    expect(canAccessApi('admin', '/api/cobros')).toBe(true);
    expect(canAccessApi('gerente', '/api/cobros')).toBe(true);
    expect(canAccessApi('analista', '/api/cobros')).toBe(true);
    expect(canAccessApi('camarero', '/api/cobros')).toBe(false);
  });

  /* ===== Eventos compartidos ===== */
  it('/api/events accesible para perfiles con planificación', () => {
    expect(canAccessApi('admin', '/api/events')).toBe(true);
    expect(canAccessApi('gerente', '/api/events')).toBe(true);
    expect(canAccessApi('jefe-cocina', '/api/events')).toBe(true);
    expect(canAccessApi('maitre', '/api/events')).toBe(true);
    expect(canAccessApi('cocinero', '/api/events')).toBe(true);
    expect(canAccessApi('camarero', '/api/events')).toBe(false);
  });

  /* ===== Invitados: camarero base ahora tiene guest-menus, no /api/guests ===== */
  it('/api/guests accesible para admin/maitre/gerente (no camarero)', () => {
    expect(canAccessApi('admin', '/api/guests')).toBe(true);
    expect(canAccessApi('maitre', '/api/guests')).toBe(true);
    expect(canAccessApi('gerente', '/api/guests')).toBe(true);
    expect(canAccessApi('camarero', '/api/guests')).toBe(false);
  });

  it('/api/guest-menus accesible para admin/maitre/camarero', () => {
    expect(canAccessApi('admin', '/api/guest-menus')).toBe(true);
    expect(canAccessApi('maitre', '/api/guest-menus')).toBe(true);
    expect(canAccessApi('camarero', '/api/guest-menus')).toBe(true);
  });

  /* ===== Analista ===== */
  it('/api/analytics accesible para admin/analista', () => {
    expect(canAccessApi('admin', '/api/analytics')).toBe(true);
    expect(canAccessApi('analista', '/api/analytics')).toBe(true);
    expect(canAccessApi('gerente', '/api/analytics')).toBe(true);
    expect(canAccessApi('camarero', '/api/analytics')).toBe(false);
  });
});

describe('Fase 1 — legacy roles ya no funcionan', () => {
  it('cocina legacy no es válido', () => expect(isRole('cocina')).toBe(false));
  it('camareros legacy no es válido', () => expect(isRole('camareros')).toBe(false));
  it('clientes legacy no es válido', () => expect(isRole('clientes')).toBe(false));
  it('legacy roles normalizan a admin', () => {
    expect(normalizeRole('cocina')).toBe('admin');
    expect(normalizeRole('camareros')).toBe('admin');
    expect(normalizeRole('clientes')).toBe('admin');
  });
});
