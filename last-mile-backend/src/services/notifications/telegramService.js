import { createNotificationChannel } from './createNotificationChannel.js';

// Canal ou groupe Telegram, via un bot (API Bot officielle : POST /bot<token>/sendMessage).
// Variables : TELEGRAM_*. Le bot doit etre administrateur du canal pour y publier.
// TELEGRAM_CHAT_ID : "@nom_du_canal" (canal public) ou identifiant numerique "-100..." (canal / groupe prive).
export const telegramChannel = createNotificationChannel({
  name: 'telegram',
  logPrefix: '[TelegramChannel]',
  envPrefix: 'TELEGRAM',
  defaultEvents: ['order.created', 'order.delivered', 'payment.confirmed'],
  readConfig: () => ({
    apiUrl: process.env.TELEGRAM_API_URL?.trim()?.replace(/\/$/, '') || 'https://api.telegram.org',
    token: process.env.TELEGRAM_BOT_TOKEN?.trim() || '',
    chatId: process.env.TELEGRAM_CHAT_ID?.trim() || ''
  }),
  validate: ({ token, chatId }) => [
    ...(/^\d+:[\w-]+$/.test(token) ? [] : ['TELEGRAM_BOT_TOKEN manquant ou mal forme (<id>:<cle>)']),
    ...(/^(@\w{5,}|-?\d+)$/.test(chatId) ? [] : ['TELEGRAM_CHAT_ID doit etre @nom_du_canal ou un identifiant numerique'])
  ],
  // Le jeton fait partie de l'URL : elle n'est jamais journalisee (voir createNotificationChannel).
  buildRequest: ({ apiUrl, token, chatId }, text) => ({
    url: `${apiUrl}/bot${token}/sendMessage`,
    init: {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })
    }
  }),
  // Telegram peut repondre HTTP 200 avec { ok: false } : on verifie les deux.
  isSuccess: (response, body) => {
    try {
      return response.ok && JSON.parse(body)?.ok === true;
    } catch {
      return false;
    }
  }
});
