import { createNotificationChannel } from './createNotificationChannel.js';

// Chaine WhatsApp (@newsletter). Variables : WHATSAPP_CHANNEL_*.
// Fournisseurs : un adaptateur par passerelle ; seul "whapi" est fourni pour l'instant.
const PROVIDERS = Object.freeze({
  whapi: ({ apiUrl, token, channelId }, text) => ({
    url: `${apiUrl}/messages/text`,
    init: {
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: channelId, body: text })
    }
  })
});

export const whatsappChannel = createNotificationChannel({
  name: 'whatsapp',
  logPrefix: '[WhatsAppChannel]',
  envPrefix: 'WHATSAPP_CHANNEL',
  defaultEvents: ['order.created', 'order.delivered', 'payment.confirmed'],
  readConfig: () => ({
    provider: process.env.WHATSAPP_CHANNEL_PROVIDER?.trim().toLowerCase() || 'whapi',
    apiUrl: process.env.WHATSAPP_CHANNEL_API_URL?.trim()?.replace(/\/$/, '') || '',
    token: process.env.WHATSAPP_CHANNEL_API_TOKEN?.trim() || '',
    channelId: process.env.WHATSAPP_CHANNEL_ID?.trim() || ''
  }),
  validate: ({ provider, apiUrl, token, channelId }) => [
    ...(PROVIDERS[provider] ? [] : [`fournisseur "${provider}" non supporte`]),
    ...(apiUrl ? [] : ['WHATSAPP_CHANNEL_API_URL manquante']),
    ...(token ? [] : ['WHATSAPP_CHANNEL_API_TOKEN manquant']),
    // Un canal public uniquement : jamais un numero de particulier (@s.whatsapp.net)
    ...(/^\d+@newsletter$/.test(channelId) ? [] : ['WHATSAPP_CHANNEL_ID doit etre de la forme <id>@newsletter'])
  ],
  buildRequest: (config, text) => PROVIDERS[config.provider](config, text)
});
