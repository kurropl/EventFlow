/**
 * EventFlow — Tests para la máquina de estados de eventos (WP-04)
 */

import { describe, it, expect } from 'vitest';
import {
  validateTransition,
  getValidTransitionsFrom,
  assertTransition,
  ALL_VALID_STATUSES,
  type EventStatus,
} from '@/domain/eventStateMachine';

describe('Event State Machine (WP-04)', () => {
  describe('VALID_TRANSITIONS', () => {
    it('should have transitions for new states', () => {
      // Verificar que existen transiciones para los nuevos estados
      const transitionsFromAccepted = getValidTransitionsFrom('accepted');
      expect(transitionsFromAccepted.some(t => t.to === 'en_preparacion')).toBe(true);
      
      const transitionsFromInProgress = getValidTransitionsFrom('in_progress');
      expect(transitionsFromInProgress.some(t => t.to === 'cerrado_operativo')).toBe(true);
      
      const transitionsFromClosedOp = getValidTransitionsFrom('cerrado_operativo');
      expect(transitionsFromClosedOp.some(t => t.to === 'cerrado_contable')).toBe(true);
    });

    it('should include legacy transitions', () => {
      // Verificar que las transiciones legadas siguen funcionando
      const transitionsFromDraft = getValidTransitionsFrom('draft');
      expect(transitionsFromDraft.some(t => t.to === 'sent')).toBe(true);
      
      const transitionsFromSent = getValidTransitionsFrom('sent');
      expect(transitionsFromSent.some(t => t.to === 'accepted')).toBe(true);
    });
  });

  describe('validateTransition', () => {
    it('should validate correct transitions', () => {
      const transition = validateTransition('draft', 'FWD-2');
      expect(transition).not.toBeNull();
      expect(transition?.to).toBe('sent');
    });

    it('should reject invalid transitions', () => {
      const transition = validateTransition('draft', 'FWD-3');
      expect(transition).toBeNull();
    });

    it('should reject non-existent transition codes', () => {
      const transition = validateTransition('draft', 'INVALID-CODE');
      expect(transition).toBeNull();
    });

    it('should validate new transitions', () => {
      const transition = validateTransition('accepted', 'OPC-1');
      expect(transition).not.toBeNull();
      expect(transition?.to).toBe('en_preparacion');
    });
  });

  describe('assertTransition', () => {
    it('should return transition for valid cases', () => {
      const transition = assertTransition('draft', 'FWD-2');
      expect(transition.to).toBe('sent');
    });

    it('should throw for invalid transitions', () => {
      expect(() => assertTransition('draft', 'FWD-3')).toThrow();
    });

    it('should throw for non-existent codes', () => {
      expect(() => assertTransition('draft', 'INVALID')).toThrow();
    });
  });

  describe('ALL_VALID_STATUSES', () => {
    it('should include all new states', () => {
      expect(ALL_VALID_STATUSES).toContain('en_preparacion');
      expect(ALL_VALID_STATUSES).toContain('cerrado_operativo');
      expect(ALL_VALID_STATUSES).toContain('cerrado_contable');
    });

    it('should include legacy states', () => {
      expect(ALL_VALID_STATUSES).toContain('draft');
      expect(ALL_VALID_STATUSES).toContain('sent');
      expect(ALL_VALID_STATUSES).toContain('accepted');
      expect(ALL_VALID_STATUSES).toContain('completed');
    });
  });

  describe('Transition flow', () => {
    it('should allow complete flow from draft to cerrado_contable', () => {
      // Draft → Sent
      let transition = validateTransition('draft', 'FWD-2');
      expect(transition?.to).toBe('sent');
      
      // Sent → Accepted
      transition = validateTransition('sent', 'FWD-3');
      expect(transition?.to).toBe('accepted');
      
      // Accepted → En Preparación
      transition = validateTransition('accepted', 'OPC-1');
      expect(transition?.to).toBe('en_preparacion');
      
      // En Preparación → In Progress
      transition = validateTransition('en_preparacion', 'OPC-2');
      expect(transition?.to).toBe('in_progress');
      
      // In Progress → Cerrado Operativo
      transition = validateTransition('in_progress', 'OPC-3');
      expect(transition?.to).toBe('cerrado_operativo');
      
      // Cerrado Operativo → Cerrado Contable
      transition = validateTransition('cerrado_operativo', 'OPC-5');
      expect(transition?.to).toBe('cerrado_contable');
    });

    it('should allow cancellation from operational states', () => {
      // Cancel from en_preparacion
      let transition = validateTransition('en_preparacion', 'INV-6');
      expect(transition?.to).toBe('cancelled');
      
      // Cancel from in_progress
      transition = validateTransition('in_progress', 'INV-6');
      expect(transition?.to).toBe('cancelled');
    });
  });
});