/**
 * EventFlow — Handlers de eventos de dominio
 * Mapa de handlers registrados por tipo de evento.
 * Cada handler es idempotente obligatoriamente.
 */

import type { DomainEvent } from '../events';
import { handleEventConfirmed } from './eventConfirmed';
import { handleEventConfirmedStaffing } from './eventConfirmedStaffing';
import { handleIngredientPriceChanged } from './ingredientPriceChanged';
import { handleStockBelowMinimum } from './stockBelowMinimum';
import { handleShiftConfirmedPreloadHours } from './shiftConfirmedPreloadHours';
import { handleEventOperationallyClosed } from './eventOperationallyClosed';
import { handleDepositPaid } from './depositPaid';

// ============================================================
// Tipo de handler
// ============================================================

export type EventHandler = (event: DomainEvent) => Promise<void>;

// ============================================================
// Registro de handlers
// ============================================================

const handlers: Record<string, EventHandler> = {
  'event.confirmed': handleEventConfirmed,
  'event.confirmed.staffing': handleEventConfirmedStaffing,
  'ingredient.price_changed': handleIngredientPriceChanged,
  'deposit.paid': handleDepositPaid,
  // TODO: Registrar aquí los handlers de otros WP
  // 'payment.milestone_due': handlePaymentMilestoneDue,
  // 'portal.frozen': handlePortalFrozen,
  // 'portal.updated': handlePortalUpdated,
  // 'menu.published': handleMenuPublished,
  // 'menu.price_changed': handleMenuPriceChanged,
  // 'purchase_order.received': handlePurchaseOrderReceived,
  'stock.below_minimum': handleStockBelowMinimum,
  'event.operationally_closed': handleEventOperationallyClosed,
  'shift.confirmed': handleShiftConfirmedPreloadHours,
};

// ============================================================
// Función para obtener handler
// ============================================================

export function getHandler(eventType: string): EventHandler | null {
  return handlers[eventType] || null;
}

// Export individual handlers for direct invocation
export { handleEventConfirmedStaffing, handleShiftConfirmedPreloadHours };

/**
 * Handler por defecto para eventos sin handler registrado.
 * Registra el evento pero no hace nada más.
 */
export async function defaultHandler(event: DomainEvent): Promise<void> {
  console.log(`[Handler] Evento sin handler registrado: ${event.event_type} (id: ${event.id})`);
}