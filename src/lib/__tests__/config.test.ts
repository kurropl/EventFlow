import { describe, it, expect } from 'vitest';
import { canSeeNav, canAccessApi, type Role } from '@/lib/rbac';

/* ================================================================= */
/*  FASE 3 — TDD: Configuración con subapartados                    */
/* ================================================================= */

describe('Fase 3 — Config: navegación a subapartados', () => {
  it('config visible solo para admin', () => {
    expect(canSeeNav('admin', 'config')).toBe(true);
    for (const r of ['gerente', 'analista', 'jefe-cocina', 'cocinero', 'maitre', 'camarero'] as Role[]) {
      expect(canSeeNav(r, 'config')).toBe(false);
    }
  });

  it('config-users visible solo para admin', () => {
    expect(canSeeNav('admin', 'config-users')).toBe(true);
    expect(canSeeNav('gerente', 'config-users')).toBe(false);
  });

  it('config-integrations visible solo para admin', () => {
    expect(canSeeNav('admin', 'config-integrations')).toBe(true);
    expect(canSeeNav('gerente', 'config-integrations')).toBe(false);
  });
});

describe('Fase 3 — Config: APIs protegidas', () => {
  it('/api/config solo admin', () => {
    expect(canAccessApi('admin', '/api/config')).toBe(true);
    expect(canAccessApi('gerente', '/api/config')).toBe(false);
    expect(canAccessApi('jefe-cocina', '/api/config')).toBe(false);
  });

  it('/api/config/users solo admin', () => {
    expect(canAccessApi('admin', '/api/config/users')).toBe(true);
    expect(canAccessApi('gerente', '/api/config/users')).toBe(false);
  });

  it('/api/webhooks solo admin', () => {
    expect(canAccessApi('admin', '/api/webhooks')).toBe(true);
    expect(canAccessApi('gerente', '/api/webhooks')).toBe(false);
  });

  it('/api/workers solo admin', () => {
    expect(canAccessApi('admin', '/api/workers')).toBe(true);
    expect(canAccessApi('gerente', '/api/workers')).toBe(false);
  });
});

describe('Fase 3 — NAV_ROLES incluye las nuevas keys', () => {
  it('config-users está definido en NAV_ROLES', () => {
    expect(canSeeNav('admin', 'config-users')).toBe(true);
  });
  it('config-integrations está definido en NAV_ROLES', () => {
    expect(canSeeNav('admin', 'config-integrations')).toBe(true);
  });
});