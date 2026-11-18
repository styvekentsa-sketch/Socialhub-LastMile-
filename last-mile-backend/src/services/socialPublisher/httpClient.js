// Client HTTP commun aux adaptateurs : delai maximal, lecture JSON, erreurs sans aucun secret.
const DEFAULT_TIMEOUT_MS = 10000;

export class PublishError extends Error {
  constructor(message, { status = null } = {}) {
    super(message);
    this.name = 'PublishError';
    this.status = status;
  }
}

export const getPublishTimeout = () => {
  const value = Number.parseInt(process.env.SOCIAL_PUBLISH_TIMEOUT_MS, 10);
  return Number.isInteger(value) ? Math.min(Math.max(value, 1000), 30000) : DEFAULT_TIMEOUT_MS;
};

/** Remplace toute occurrence d'un secret (jeton, cle) par un masque. */
export const scrubSecrets = (text, secrets = []) => secrets
  .filter((secret) => typeof secret === 'string' && secret.length >= 4)
  .reduce((result, secret) => result.split(secret).join('••••'), String(text ?? ''));

const describeProviderError = (json, rawText) => (
  json?.error?.message // Meta (Graph API)
  || json?.description // Telegram
  || json?.message // LinkedIn, Whapi
  || json?.error // texte libre
  || rawText
  || 'reponse vide'
);

/**
 * Envoie une requete et renvoie { status, json, headers }. Leve PublishError si la requete echoue.
 * L'URL n'est jamais incluse dans les erreurs (elle peut contenir un jeton, ex. Telegram).
 */
export const requestJson = async (url, init, { secrets = [], platformLabel }) => {
  let response;

  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(getPublishTimeout()) });
  } catch (error) {
    const isTimeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    const cause = error?.cause?.code || error?.cause?.message || error?.message;
    throw new PublishError(scrubSecrets(isTimeout ? `${platformLabel} : delai depasse` : `${platformLabel} injoignable (${cause})`, secrets));
  }

  const rawText = await response.text().catch(() => '');
  let json = null;
  try { json = rawText ? JSON.parse(rawText) : null; } catch { json = null; }

  if (!response.ok) {
    const detail = describeProviderError(json, rawText);
    const message = `${platformLabel} a refuse la publication (HTTP ${response.status}) : ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`;
    throw new PublishError(scrubSecrets(message, secrets).slice(0, 480), { status: response.status });
  }

  return { status: response.status, json, headers: response.headers };
};

export const baseUrlFromEnv = (name, fallback) => (process.env[name]?.trim() || fallback).replace(/\/+$/, '');
