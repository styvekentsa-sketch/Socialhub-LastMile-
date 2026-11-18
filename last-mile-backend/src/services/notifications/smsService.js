import { createNotificationChannel } from './createNotificationChannel.js';

// Canal SMS de secours : alertes textuelles vers une liste FIXE de destinataires internes
// (equipe d'exploitation, astreinte), definie dans SMS_RECIPIENTS.
// Le numero du client n'est jamais lu : ce canal n'ecrit pas aux clients.
// Par defaut, seuls les echecs de livraison sont envoyes (un SMS est payant).
//
// Fournisseur "http" : passerelle generique qui recoit
//   POST SMS_API_URL   Authorization: Bearer SMS_API_KEY
//   { "from": SMS_SENDER, "to": ["+2376..."], "message": "..." }
// Pour un operateur precis (Orange, MTN, Twilio...), ajouter un adaptateur dans PROVIDERS.
const PHONE_PATTERN = /^\+\d{8,15}$/;

const PROVIDERS = Object.freeze({
  http: ({ apiUrl, apiKey, sender, recipients }, text) => ({
    url: apiUrl,
    init: {
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: sender, to: recipients, message: text })
    }
  })
});

const parseRecipients = (value) => String(value || '').split(',').map((phone) => phone.replace(/\s/g, '')).filter(Boolean);

export const smsChannel = createNotificationChannel({
  name: 'sms',
  logPrefix: '[SmsChannel]',
  envPrefix: 'SMS',
  defaultEvents: ['order.failed'],
  readConfig: () => ({
    provider: process.env.SMS_PROVIDER?.trim().toLowerCase() || 'http',
    apiUrl: process.env.SMS_API_URL?.trim() || '',
    apiKey: process.env.SMS_API_KEY?.trim() || '',
    sender: process.env.SMS_SENDER?.trim() || 'LastMile',
    recipients: parseRecipients(process.env.SMS_RECIPIENTS)
  }),
  validate: ({ provider, apiUrl, apiKey, recipients }) => [
    ...(PROVIDERS[provider] ? [] : [`fournisseur "${provider}" non supporte`]),
    ...(apiUrl ? [] : ['SMS_API_URL manquante']),
    ...(apiKey ? [] : ['SMS_API_KEY manquante']),
    ...(recipients.length > 0 ? [] : ['SMS_RECIPIENTS vide']),
    ...(recipients.every((phone) => PHONE_PATTERN.test(phone)) ? [] : ['SMS_RECIPIENTS : numeros au format international (+237...)'])
  ],
  buildRequest: (config, text) => PROVIDERS[config.provider](config, text)
});
