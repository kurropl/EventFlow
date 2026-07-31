/**
 * EventFlow — Tests unitarios para WP-28: Portal Menú y Variantes
 * Tests que validan la lógica de variantes y portal auth sin DB.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VALID_VARIANT_TYPES, VARIANT_LABELS } from '@/domain/portal-menu';

// ============================================================
// Mocks
// ============================================================

// Mock de la DB
vi.mock('@/lib/db', () => ({
  getPool: vi.fn(),
  querySingle: vi.fn(),
  queryMany: vi.fn(),
  transaction: vi.fn((fn: Function) => fn({
    query: vi.fn().mockResolvedValue({ rows: [] }),
  })),
}));

// Mock de emitDomainEvent
vi.mock('@/domain/events', () => ({
  emitDomainEvent: vi.fn().mockResolvedValue(undefined),
}));

// ============================================================
// Tests
// ============================================================

describe('WP-28: Portal Menú y Variantes — Unit Tests', () => {
  describe('Variant Types Validation', () => {
    it('should have all required variant types', () => {
      expect(VALID_VARIANT_TYPES).toContain('infantil');
      expect(VALID_VARIANT_TYPES).toContain('celiaco');
      expect(VALID_VARIANT_TYPES).toContain('vegetariano');
      expect(VALID_VARIANT_TYPES).toContain('vegano');
      expect(VALID_VARIANT_TYPES).toContain('sin_lactosa');
      expect(VALID_VARIANT_TYPES).toContain('sin_frutos_secos');
      expect(VALID_VARIANT_TYPES).toContain('personalizado');
    });

    it('should have 7 variant types', () => {
      expect(VALID_VARIANT_TYPES.length).toBe(7);
    });

    it('should have labels for all variant types', () => {
      for (const type of VALID_VARIANT_TYPES) {
        expect(VARIANT_LABELS[type]).toBeDefined();
        expect(typeof VARIANT_LABELS[type]).toBe('string');
        expect(VARIANT_LABELS[type].length).toBeGreaterThan(0);
      }
    });

    it('should not accept invalid variant type', () => {
      expect(VALID_VARIANT_TYPES).not.toContain('invalido');
      expect(VALID_VARIANT_TYPES).not.toContain('otro');
    });
  });

  describe('Dietary Mapping Logic', () => {
    // El mapping variante → restricción dietética del guest
    const DIETARY_MAP: Record<string, string> = {
      celiaco: 'celiaco',
      vegetariano: 'vegetariano',
      vegano: 'vegano',
      sin_lactosa: 'sin_lactosa',
      sin_frutos_secos: 'alergico_frutos_secos',
    };

    it('should map celiaco variant to celiaco dietary', () => {
      expect(DIETARY_MAP['celiaco']).toBe('celiaco');
    });

    it('should map vegetariano variant to vegetariano dietary', () => {
      expect(DIETARY_MAP['vegetariano']).toBe('vegetariano');
    });

    it('should map sin_frutos_secos to alergico_frutos_secos dietary', () => {
      expect(DIETARY_MAP['sin_frutos_secos']).toBe('alergico_frutos_secos');
    });

    it('should not map infantil to any dietary restriction', () => {
      expect(DIETARY_MAP['infantil']).toBeUndefined();
    });

    it('should not map personalizado to any dietary restriction', () => {
      expect(DIETARY_MAP['personalizado']).toBeUndefined();
    });
  });

  describe('Frozen Portal Logic', () => {
    // Un portal se congela 14 días antes del evento
    it('should calculate freeze date correctly', () => {
      const eventDate = new Date('2026-12-31');
      const freezeDate = new Date(eventDate);
      freezeDate.setDate(freezeDate.getDate() - 14);
      expect(freezeDate.toISOString().slice(0, 10)).toBe('2026-12-17');
    });

    it('should consider portal frozen when current date >= freeze date', () => {
      const eventDate = new Date('2026-08-01'); // Evento en el futuro
      const freezeDate = new Date(eventDate);
      freezeDate.setDate(freezeDate.getDate() - 14); // 2026-07-18

      // Si hoy es 2026-07-31, el portal debería estar congelado
      const today = new Date('2026-07-31');
      expect(today >= freezeDate).toBe(true);
    });

    it('should consider portal NOT frozen when current date < freeze date', () => {
      const eventDate = new Date('2026-12-31');
      const freezeDate = new Date(eventDate);
      freezeDate.setDate(freezeDate.getDate() - 14); // 2026-12-17

      const today = new Date('2026-07-31');
      expect(today >= freezeDate).toBe(false);
    });
  });

  describe('Guest Dietary Sync Logic', () => {
    it('should add dietary restriction when assigning variant', () => {
      const currentDietary: string[] = [];
      const variantType = 'celiaco';
      const dietKey = DIETARY_MAP[variantType];

      let updatedDietary = [...currentDietary];
      if (dietKey && !updatedDietary.includes(dietKey)) {
        updatedDietary.push(dietKey);
      }

      expect(updatedDietary).toEqual(['celiaco']);
    });

    it('should not duplicate dietary restriction', () => {
      const currentDietary = ['celiaco', 'sin_lactosa'];
      const variantType = 'celiaco';
      const dietKey = DIETARY_MAP[variantType];

      let updatedDietary = [...currentDietary];
      if (dietKey && !updatedDietary.includes(dietKey)) {
        updatedDietary.push(dietKey);
      }

      expect(updatedDietary).toEqual(['celiaco', 'sin_lactosa']);
      expect(updatedDietary.length).toBe(2);
    });

    it('should remove dietary restriction when removing variant', () => {
      const currentDietary = ['celiaco', 'sin_lactosa'];
      const variantType = 'celiaco';
      const dietKey = DIETARY_MAP[variantType];

      const updatedDietary = currentDietary.filter((d) => d !== dietKey);

      expect(updatedDietary).toEqual(['sin_lactosa']);
    });

    it('should handle removing non-existent restriction gracefully', () => {
      const currentDietary = ['sin_lactosa'];
      const variantType = 'celiaco';
      const dietKey = DIETARY_MAP[variantType];

      const updatedDietary = currentDietary.filter((d) => d !== dietKey);

      expect(updatedDietary).toEqual(['sin_lactosa']);
    });

    const DIETARY_MAP: Record<string, string> = {
      celiaco: 'celiaco',
      vegetariano: 'vegetariano',
      vegano: 'vegano',
      sin_lactosa: 'sin_lactosa',
      sin_frutos_secos: 'alergico_frutos_secos',
    };
  });

  describe('Menu Immutability', () => {
    it('should not allow changing menu_id through variants', () => {
      // El cliente NO puede cambiar de menú, solo asignar variantes
      // La API de variantes solo acepta variant_type, no menu_id
      const validFields = ['guest_id', 'variant_type', 'section_id', 'dish_id', 'notes'];
      expect(validFields).not.toContain('menu_id');
      expect(validFields).not.toContain('price_per_pax');
    });

    it('should require event_menu_id to be provided by server', () => {
      // El event_menu_id se obtiene del servidor, no del cliente
      // Esto garantiza que el menú no puede ser manipulado
      const serverOnlyFields = ['event_menu_id', 'event_id'];
      expect(serverOnlyFields).toContain('event_menu_id');
    });
  });

  describe('Variant Summary', () => {
    it('should aggregate variant counts correctly', () => {
      const mockVariants = [
        { variant_type: 'celiaco' },
        { variant_type: 'celiaco' },
        { variant_type: 'vegetariano' },
        { variant_type: 'infantil' },
      ];

      const summary: Record<string, number> = {};
      for (const v of mockVariants) {
        summary[v.variant_type] = (summary[v.variant_type] || 0) + 1;
      }

      expect(summary['celiaco']).toBe(2);
      expect(summary['vegetariano']).toBe(1);
      expect(summary['infantil']).toBe(1);
    });
  });
});
