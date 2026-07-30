/**
 * EventFlow — Handlers de eventos de dominio
 * Mapa de handlers registrados por tipo de evento.
 * Cada handler es idempotente obligatoriamente.
 */

import type { DomainEvent } from '../events';
import { handleEventConfirmed } from './eventConfirmed';
import { handleStockBelowMinimum } from './stockBelowMinimum';

// ============================================================
// Tipo de handler
// ============================================================

export type EventHandler = (event: DomainEvent) => Promise<void>;

// ============================================================
// Registro de handlers
// ============================================================

const handlers: Record<string, EventHandler> = {
  'event.confirmed': handleEventConfirmed,
  // TODO: Registrar aquí los handlers de otros WP
  // 'deposit.paid': handleDepositPaid,
  // 'payment.milestone_due': handlePaymentMilestoneDue,
  // 'portal.frozen': handlePortalFrozen,
  // 'portal.updated': handlePortalUpdated,
  // 'menu.published': handleMenuPublished,
  // 'menu.price_changed': handleMenuPriceChanged,
  // 'ingredient.price_changed': handleIngredientPriceChanged,
  // 'purchase_order.received': handlePurchaseOrderReceived,
  'stock.below_minimum': handleStockBelowMinimum,
  // 'event.operationally_closed': handleEventOperationallyClosed,
  // 'event.financially_closed': handleEventFinanciallyClosed,
  // 'shift.offered': handleShiftOffered,
  // 'shift.confirmed': handleShiftConfirmed,
};

// ============================================================
// Función para obtener handler
// ============================================================

export function getHandler(eventType: string): EventHandler | null {
  return handlers[eventType] || null;
}

/**
 * Handler por defecto para eventos sin handler registrado.
 * Registra el evento pero no hace nada más.
 */
export async function defaultHandler(event: DomainEvent): Promise<void> {
  console.log(`[Handler] Evento sin handler registrado: ${event.event_type} (id: ${event.id})`);
}