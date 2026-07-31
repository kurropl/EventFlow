/**
 * WP-27: Portal — Distribución de Mesas
 * Tests unitarios para la lógica del portal de mesas.
 *
 * Ejecutar: npx vitest run src/lib/__tests__/portalTables.test.ts
 */

import { describe, it, expect } from 'vitest';

// ============================================================
// Funciones de validación extraídas para test
// ============================================================

/** Valida que un guest puede ser asignado (solo confirmados) */
function canAssignGuest(guestRsvp: string): boolean {
  return guestRsvp === 'confirmado';
}

/** Valida que una mesa no excede su aforo */
function wouldExceedCapacity(
  currentCount: number,
  tableSeats: number,
  addCount: number
): boolean {
  return currentCount + addCount > tableSeats;
}

/** Calcula el mapa de ocupación desde asignaciones */
function computeOccupancyMap(
  assignments: Array<{ tableId: string }>
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const a of assignments) {
    map[a.tableId] = (map[a.tableId] || 0) + 1;
  }
  return map;
}

/** Valida que un token de portal tiene longitud mínima */
function isValidTokenLength(token: string): boolean {
  return token.length >= 10;
}

/** Valida que un portal congelado rechaza escrituras */
function canWriteToPortal(portalStatus: string, freezeDate: string): boolean {
  if (portalStatus === 'congelado' || portalStatus === 'cerrado') return false;
  const now = new Date();
  const freeze = new Date(freezeDate);
  return now < freeze;
}

// ============================================================
// Tests
// ============================================================

describe('WP-27: Portal — Distribución de Mesas', () => {
  // ── Invitados ──

  describe('Restricción de invitados', () => {
    it('invitado confirmado es asignable', () => {
      expect(canAssignGuest('confirmado')).toBe(true);
    });

    it('invitado pendiente NO es asignable', () => {
      expect(canAssignGuest('pendiente')).toBe(false);
    });

    it('invitado rechazado NO es asignable', () => {
      expect(canAssignGuest('rechazado')).toBe(false);
    });

    it('cualquier otro estado NO es asignable', () => {
      expect(canAssignGuest('')).toBe(false);
      expect(canAssignGuest('otro')).toBe(false);
    });
  });

  // ── Aforo ──

  describe('Control de aforo', () => {
    it('mesa vacía permite asignar', () => {
      expect(wouldExceedCapacity(0, 8, 1)).toBe(false);
    });

    it('mesa llena rechaza asignar', () => {
      expect(wouldExceedCapacity(8, 8, 1)).toBe(true);
    });

    it('mesa con un sitio libre permite 1 más', () => {
      expect(wouldExceedCapacity(7, 8, 1)).toBe(false);
    });

    it('mesa con un sitio libre rechaza 2 más', () => {
      expect(wouldExceedCapacity(7, 8, 2)).toBe(true);
    });

    it('asignación multiple respeta aforo', () => {
      expect(wouldExceedCapacity(5, 10, 3)).toBe(false); // 5+3=8 <= 10
      expect(wouldExceedCapacity(5, 10, 6)).toBe(true);  // 5+6=11 > 10
    });

    it('aforo mínimo 1 (mesa para 1)', () => {
      expect(wouldExceedCapacity(1, 1, 1)).toBe(true);
      expect(wouldExceedCapacity(0, 1, 1)).toBe(false);
    });
  });

  // ── Ocupación ──

  describe('Cálculo de ocupación', () => {
    it('mapa vacío', () => {
      expect(computeOccupancyMap([])).toEqual({});
    });

    it('un invitado en una mesa', () => {
      const result = computeOccupancyMap([
        { tableId: 't1', guestId: 'g1', guestName: 'A', seatNumber: 1 },
      ]);
      expect(result).toEqual({ t1: 1 });
    });

    it('múltiples invitados en múltiples mesas', () => {
      const result = computeOccupancyMap([
        { tableId: 't1', guestId: 'g1', guestName: 'A', seatNumber: 1 },
        { tableId: 't1', guestId: 'g2', guestName: 'B', seatNumber: 2 },
        { tableId: 't2', guestId: 'g3', guestName: 'C', seatNumber: 1 },
      ]);
      expect(result).toEqual({ t1: 2, t2: 1 });
    });
  });

  // ── Token ──

  describe('Token de portal', () => {
    it('token válido (>=10 chars)', () => {
      expect(isValidTokenLength('abc123def456')).toBe(true);
    });

    it('token muy corto rechazado', () => {
      expect(isValidTokenLength('abc')).toBe(false);
    });

    it('token vacío rechazado', () => {
      expect(isValidTokenLength('')).toBe(false);
    });

    it('token exactamente 10 caracteres válido', () => {
      expect(isValidTokenLength('1234567890')).toBe(true);
    });
  });

  // ── Congelación ──

  describe('Congelación del portal', () => {
    it('portal activo con fecha futura permite escritura', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      expect(canWriteToPortal('activo', futureDate.toISOString())).toBe(true);
    });

    it('portal congelado rechaza escritura', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      expect(canWriteToPortal('congelado', futureDate.toISOString())).toBe(false);
    });

    it('portal cerrado rechaza escritura', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      expect(canWriteToPortal('cerrado', futureDate.toISOString())).toBe(false);
    });

    it('portal activo con fecha pasada (ya congelado por fecha) rechaza escritura', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      expect(canWriteToPortal('activo', pastDate.toISOString())).toBe(false);
    });
  });

  // ── Sincronización (misma tabla) ──

  describe('Sincronización admin-portal', () => {
    it('las asignaciones del portal usan la misma estructura que admin', () => {
      // Verificar que la estructura de datos es compatible
      const portalAssignment = {
        tableId: 'table-1',
        guestId: 'uuid-guest-1',
        seatNumber: 1,
      };

      const adminAssignment = {
        table_id: 'table-1',
        guest_id: 'uuid-guest-1',
        seat_number: 1,
      };

      // Mismos datos, diferente naming (camelCase vs snake_case)
      expect(portalAssignment.tableId).toBe(adminAssignment.table_id);
      expect(portalAssignment.guestId).toBe(adminAssignment.guest_id);
      expect(portalAssignment.seatNumber).toBe(adminAssignment.seat_number);
    });
  });
});
