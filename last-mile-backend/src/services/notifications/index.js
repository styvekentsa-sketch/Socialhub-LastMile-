import { ORDER_EVENTS, orderEvents } from '../../events/orderEvents.js';
import { linkedinChannel } from './linkedinService.js';
import { messengerChannel } from './messengerService.js';
import { smsChannel } from './smsService.js';
import { telegramChannel } from './telegramService.js';
import { whatsappChannel } from './whatsappService.js';

// Registre des canaux. Ajouter un canal (email, Slack...) = creer son fichier avec
// createNotificationChannel() puis l'ajouter ici : ni le bus ni les controleurs ne changent.
export const NOTIFICATION_CHANNELS = Object.freeze([
  whatsappChannel, telegramChannel, smsChannel, messengerChannel, linkedinChannel
]);

let isInitialized = false;

export const initializeNotificationChannels = () => {
  if (isInitialized) {
    return;
  }

  for (const eventName of Object.values(ORDER_EVENTS)) {
    // Fire-and-forget : chaque canal publie en parallele ; un canal en panne n'affecte ni les autres ni la requete HTTP.
    orderEvents.on(eventName, (payload) => {
      for (const channel of NOTIFICATION_CHANNELS) {
        void channel.publish(eventName, payload);
      }
    });
  }

  isInitialized = true;
  NOTIFICATION_CHANNELS.forEach((channel) => console.log(channel.describe()));
};
