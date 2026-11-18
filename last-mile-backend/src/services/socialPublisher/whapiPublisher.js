import { baseUrlFromEnv, PublishError, requestJson } from './httpClient.js';

// Chaine WhatsApp du marchand via Whapi.cloud, avec SON jeton (Bearer) et SA chaine (...@newsletter).
// Avec image : POST /messages/image { to, media, caption } ; sinon : POST /messages/text { to, body }.
// L'adresse de l'API vient de la configuration du serveur (SOCIAL_WHAPI_API_URL), jamais du marchand.
export const publishToWhapi = async ({ credentials, post }) => {
  const base = baseUrlFromEnv('SOCIAL_WHAPI_API_URL', 'https://gate.whapi.cloud');
  const withImage = Boolean(post.imageUrl);
  const { json } = await requestJson(`${base}/messages/${withImage ? 'image' : 'text'}`, {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: `Bearer ${credentials.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(withImage
      ? { to: credentials.channel_id, media: post.imageUrl, caption: post.text }
      : { to: credentials.channel_id, body: post.text })
  }, { secrets: [credentials.token], platformLabel: 'WhatsApp (Whapi)' });

  if (json?.sent === false) {
    throw new PublishError('WhatsApp (Whapi) a refuse la publication : message non envoye');
  }
  return { externalPostId: json?.message?.id ?? json?.id ?? null };
};
