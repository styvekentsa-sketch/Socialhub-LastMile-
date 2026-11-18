import { EventEmitter } from 'node:events';

// Bus d'evenements metier interne. Les controleurs et services emettent ici ;
// les integrations externes (WhatsApp, etc.) s'y abonnent sans etre connues des controleurs.
export const ORDER_EVENTS = Object.freeze({
  ORDER_CREATED: 'order.created',
  ORDER_STATUS_CHANGED: 'order.status_changed',
  PAYMENT_CONFIRMED: 'payment.confirmed'
});

const KNOWN_EVENTS = new Set(Object.values(ORDER_EVENTS));

export const orderEvents = new EventEmitter();
orderEvents.setMaxListeners(20);

// Sans ecouteur 'error', une erreur emise ferait planter le processus.
orderEvents.on('error', (error) => {
  console.error('[orderEvents] Erreur dans un abonne :', error?.message || error);
});

/**
 * Emet un evenement metier sans jamais faire echouer l'appelant.
 * Payloads attendus :
 *   order.created         { orderId, merchantId }
 *   order.status_changed  { orderId, status, previousStatus? }
 *   payment.confirmed     { orderId, merchantId }
 */
export const emitOrderEvent = (eventName, payload = {}) => {
  if (!KNOWN_EVENTS.has(eventName)) {
    console.warn(`[orderEvents] Evenement inconnu ignore : ${eventName}`);
    return false;
  }

  try {
    return orderEvents.emit(eventName, { ...payload, occurredAt: new Date().toISOString() });
  } catch (error) {
    console.error(`[orderEvents] Echec d'un abonne pour ${eventName} :`, error?.message || error);
    return false;
  }
};
