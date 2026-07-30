/**
 * EventFlow — Máquina de estados ampliada para events.status (WP-04)
 * Única fuente de verdad para transiciones válidas.
 *
 * Estados:
 *   Legados: draft, sent, accepted, completed, lost, reopened, paid, presupuestado, cancelado
 *   Nuevos WP-04: en_preparacion, cerrado_operativo, cerrado_contable
 *
 * Notas:
 *   - 'completado' se conserva como alias legado de 'cerrado_operativo'
 *   - 'cancelado' ya existía en el CHECK original
 */

export type EventStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'paid'
  | 'cancelled'
  | 'lost'
  | 'reopened'
  | 'presupuestado'
  // Nuevos estados WP-04
  | 'en_preparacion'
  | 'cerrado_operativo'
  | 'cerrado_contable';

// ============================================================
// Matriz de transiciones válidas
// ============================================================

export interface Transition {
  code: string;
  from: EventStatus[];
  to: EventStatus;
  description: string;
}

export const VALID_TRANSITIONS: Transition[] = [
  // --- Transiciones legadas (existentes) ---
  { code: 'FWD-2', from: ['draft'],     to: 'sent',          description: 'Enviar propuesta' },
  { code: 'FWD-3', from: ['sent'],      to: 'accepted',      description: 'Aceptar propuesta' },
  { code: 'FWD-4', from: ['accepted'],  to: 'completed',     description: 'Marcar como completado (legado)' },
  { code: 'INV-1', from: ['sent'],      to: 'lost',          description: 'Marcar como perdido' },
  { code: 'INV-2', from: ['accepted'],  to: 'sent',          description: 'Volver a enviar' },
  { code: 'INV-3', from: ['accepted'],  to: 'cancelled',     description: 'Cancelar evento' },
  { code: 'INV-4', from: ['completed'], to: 'reopened',      description: 'Reabrir evento' },
  { code: 'INV-5', from: ['reopened'],  to: 'completed',     description: 'Volver a completar' },
  { code: 'PAY-1', from: ['accepted'],  to: 'presupuestado', description: 'Pasar a presupuestado' },
  { code: 'PAY-2', from: ['completed'], to: 'paid',          description: 'Marcar como pagado' },

  // --- Nuevas transiciones WP-04 ---
  // Preparación del evento
  { code: 'OPC-1', from: ['accepted'],      to: 'en_preparacion',   description: 'Iniciar preparación' },
  { code: 'OPC-2', from: ['en_preparacion'], to: 'in_progress',     description: 'Comenzar evento (día D)' },

  // Cierre operativo
  { code: 'OPC-3', from: ['in_progress'],   to: 'cerrado_operativo', description: 'Cierre operativo (checklist completo)' },
  { code: 'OPC-4', from: ['en_preparacion'], to: 'cerrado_operativo', description: 'Cierre operativo directo (sin evento físico)' },

  // Cierre contable
  { code: 'OPC-5', from: ['cerrado_operativo'], to: 'cerrado_contable', description: 'Cierre contable (finanzas)' },

  // Cancelación desde cualquier estado operativo
  { code: 'INV-6', from: ['en_preparacion', 'in_progress'], to: 'cancelled', description: 'Cancelar evento en curso' },

  // Reapertura desde cierre operativo (para correcciones)
  { code: 'INV-7', from: ['cerrado_operativo'], to: 'in_progress', description: 'Reabrir desde cierre operativo' },
];

// ============================================================
// Funciones de validación
// ============================================================

/**
 * Valida si una transición es válida dados el estado actual y el código de transición.
 * @returns La transición si es válida, null si no existe o no es aplicable.
 */
export function validateTransition(
  currentStatus: EventStatus,
  transitionCode: string
): Transition | null {
  const transition = VALID_TRANSITIONS.find(t => t.code === transitionCode);
  if (!transition) return null;
  if (!transition.from.includes(currentStatus)) return null;
  return transition;
}

/**
 * Obtiene todas las transiciones válidas desde un estado dado.
 */
export function getValidTransitionsFrom(status: EventStatus): Transition[] {
  return VALID_TRANSITIONS.filter(t => t.from.includes(status));
}

/**
 * Verifica si una transición es válida lanza error si no lo es.
 */
export function assertTransition(
  currentStatus: EventStatus,
  transitionCode: string
): Transition {
  const transition = validateTransition(currentStatus, transitionCode);
  if (!transition) {
    throw new Error(
      `Transición inválida: ${transitionCode} no es válida desde el estado '${currentStatus}'`
    );
  }
  return transition;
}

// ============================================================
// Estados válidos para el CHECK de la BD
// ============================================================

export const ALL_VALID_STATUSES: EventStatus[] = [
  // Legados
  'draft',
  'sent',
  'accepted',
  'in_progress',
  'completed',
  'paid',
  'cancelled',
  'lost',
  'reopened',
  'presupuestado',
  // Nuevos WP-04
  'en_preparacion',
  'cerrado_operativo',
  'cerrado_contable',
];