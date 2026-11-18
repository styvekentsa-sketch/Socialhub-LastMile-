import { ORDER_EVENTS } from '../../events/orderEvents.js';

// REGLE DE CONFIDENTIALITE COMMUNE A TOUS LES CANAUX (WhatsApp, Telegram, SMS...)
// Un message public est construit UNIQUEMENT a partir :
//   - d'un modele de texte fixe ci-dessous,
//   - d'un identifiant de commande numerique,
//   - d'un statut pris dans une liste fermee.
// Aucun autre champ du payload (nom, telephone, email, adresse, GPS...) n'est jamais lu :
// une donnee personnelle ne peut donc pas fuiter, meme si un appelant la transmet par erreur.
export const MESSAGE_TEMPLATES = Object.freeze({
  'order.created': (orderId) => `Nouvelle commande #${orderId} validée.`,
  'payment.confirmed': (orderId) => `Paiement confirmé : nouvelle commande #${orderId} validée.`,
  'order.assigned': (orderId) => `Commande #${orderId} prise en charge par un livreur.`,
  'order.picking': (orderId) => `Un livreur est en route pour récupérer le colis #${orderId}.`,
  'order.picked_up': (orderId) => `Colis #${orderId} récupéré.`,
  'order.in_transit': (orderId) => `Colis #${orderId} en cours de livraison.`,
  'order.delivered': (orderId) => `Colis #${orderId} livré avec succès.`,
  'order.failed': (orderId) => `Livraison du colis #${orderId} non aboutie.`,
  'order.cancelled': (orderId) => `Commande #${orderId} annulée.`
});

const toOrderId = (value) => {
  const orderId = Number(value);
  return Number.isSafeInteger(orderId) && orderId > 0 ? orderId : null;
};

// Traduit un evenement du bus en cle de message (ex. order.status_changed + delivered -> order.delivered).
const resolveMessageKey = (eventName, payload) => {
  if (eventName === ORDER_EVENTS.ORDER_STATUS_CHANGED) {
    return typeof payload?.status === 'string' ? `order.${payload.status}` : null;
  }

  return eventName;
};

/** Renvoie { messageKey, orderId, text } ou null si aucun message public ne correspond. */
export const buildPublicMessage = (eventName, payload) => {
  const messageKey = resolveMessageKey(eventName, payload);
  const template = messageKey ? MESSAGE_TEMPLATES[messageKey] : undefined;
  const orderId = toOrderId(payload?.orderId);

  if (!template || !orderId) {
    return null;
  }

  return { messageKey, orderId, text: template(orderId) };
};
