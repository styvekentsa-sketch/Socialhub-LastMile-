import { baseUrlFromEnv, PublishError, requestJson } from './httpClient.js';

// Canal Telegram du marchand, via SON bot (administrateur du canal).
// Avec image : sendPhoto { chat_id, photo, caption } ; sinon : sendMessage { chat_id, text }.
// Le jeton fait partie de l'URL : celle-ci n'apparait jamais dans les erreurs ni les journaux.
export const publishToTelegram = async ({ credentials, post }) => {
  const base = baseUrlFromEnv('SOCIAL_TELEGRAM_API_URL', 'https://api.telegram.org');
  const withImage = Boolean(post.imageUrl);
  const { json } = await requestJson(`${base}/bot${credentials.bot_token}/${withImage ? 'sendPhoto' : 'sendMessage'}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(withImage
      ? { chat_id: credentials.chat_id, photo: post.imageUrl, caption: post.caption }
      : { chat_id: credentials.chat_id, text: post.text })
  }, { secrets: [credentials.bot_token], platformLabel: 'Telegram' });

  // Telegram peut repondre HTTP 200 avec { ok: false }
  if (json?.ok !== true) {
    throw new PublishError(`Telegram a refuse la publication : ${json?.description || 'reponse inattendue'}`);
  }
  return { externalPostId: json.result?.message_id != null ? String(json.result.message_id) : null };
};
