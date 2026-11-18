import { createNotificationChannel } from './createNotificationChannel.js';

// Alertes operationnelles via Facebook Messenger (API Graph de Meta : POST /<version>/me/messages).
// Variables : MESSENGER_*.
//
// Contraintes de la plateforme (a connaitre avant activation) :
// - L'API d'envoi n'ecrit pas dans un groupe : elle ecrit a UNE personne identifiee par la page (PSID).
//   MESSENGER_RECIPIENT_ID = PSID d'un membre de l'equipe d'exploitation (jamais un client).
// - Messages de type "UPDATE" : Meta n'autorise l'envoi que dans les 24 h suivant le dernier message
//   de ce destinataire a la page. Hors de cette fenetre, Meta refuse l'envoi (journalise, sans planter).
// - Le jeton de page est envoye dans l'en-tete Authorization, jamais dans l'URL.
export const messengerChannel = createNotificationChannel({
  name: 'messenger',
  logPrefix: '[MessengerChannel]',
  envPrefix: 'MESSENGER',
  defaultEvents: ['order.failed', 'order.cancelled'],
  readConfig: () => ({
    apiUrl: process.env.MESSENGER_API_URL?.trim()?.replace(/\/$/, '') || 'https://graph.facebook.com',
    graphVersion: process.env.MESSENGER_GRAPH_VERSION?.trim() || 'v23.0',
    pageToken: process.env.MESSENGER_PAGE_TOKEN?.trim() || '',
    recipientId: process.env.MESSENGER_RECIPIENT_ID?.trim() || ''
  }),
  validate: ({ graphVersion, pageToken, recipientId }) => [
    ...(/^v\d+\.\d+$/.test(graphVersion) ? [] : ['MESSENGER_GRAPH_VERSION doit etre de la forme v23.0']),
    ...(pageToken ? [] : ['MESSENGER_PAGE_TOKEN manquant']),
    ...(/^\d+$/.test(recipientId) ? [] : ['MESSENGER_RECIPIENT_ID doit etre un identifiant numerique (PSID)'])
  ],
  buildRequest: ({ apiUrl, graphVersion, pageToken, recipientId }, text) => ({
    url: `${apiUrl}/${graphVersion}/me/messages`,
    init: {
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: `Bearer ${pageToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: recipientId }, messaging_type: 'UPDATE', message: { text } })
    }
  }),
  // Succes = HTTP 2xx avec un identifiant de message
  isSuccess: (response, body) => {
    try {
      return response.ok && Boolean(JSON.parse(body)?.message_id);
    } catch {
      return false;
    }
  }
});
