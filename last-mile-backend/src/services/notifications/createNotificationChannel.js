import { buildPublicMessage, MESSAGE_TEMPLATES } from './messageTemplates.js';

const DEFAULT_TIMEOUT_MS = 5000;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 30000;

const parseTimeout = (value) => {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue)
    ? Math.min(Math.max(parsedValue, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS)
    : DEFAULT_TIMEOUT_MS;
};

const parseEvents = (value, defaultEvents, logPrefix) => {
  const events = String(value || '').split(',').map((key) => key.trim()).filter(Boolean);
  const selected = events.length > 0 ? events : defaultEvents;
  const unknown = selected.filter((key) => !MESSAGE_TEMPLATES[key]);

  if (unknown.length > 0) {
    console.warn(`${logPrefix} Cles inconnues ignorees : ${unknown.join(', ')}`);
  }

  return new Set(selected.filter((key) => MESSAGE_TEMPLATES[key]));
};

/**
 * Fabrique d'un canal de notification. Chaque canal (WhatsApp, Telegram, SMS...) ne fournit que :
 *   - envPrefix      : prefixe de ses variables (<PREFIX>_ENABLED, <PREFIX>_EVENTS, <PREFIX>_TIMEOUT_MS)
 *   - readConfig()   : ses parametres propres (URL, jeton, destinataire...)
 *   - validate(cfg)  : liste des problemes de configuration (tableau vide si tout va bien)
 *   - buildRequest(cfg, text) : { url, init } pour fetch
 *   - isSuccess(response, body) : facultatif, par defaut response.ok
 * Le reste est commun : interrupteur, filtre d'evenements, delai maximal, journaux, aucune exception.
 * Les journaux n'affichent jamais l'URL (elle peut contenir un jeton, ex. Telegram).
 */
export const createNotificationChannel = ({
  name, logPrefix, envPrefix, defaultEvents, readConfig, validate, buildRequest, isSuccess = (response) => response.ok
}) => {
  const getConfig = () => ({
    enabled: process.env[`${envPrefix}_ENABLED`]?.trim().toLowerCase() === 'true',
    events: parseEvents(process.env[`${envPrefix}_EVENTS`], defaultEvents, logPrefix),
    timeoutMs: parseTimeout(process.env[`${envPrefix}_TIMEOUT_MS`]),
    ...readConfig()
  });

  /** Publie un message. Ne leve JAMAIS d'exception : renvoie { sent, reason }. */
  const publish = async (eventName, payload) => {
    try {
      const message = buildPublicMessage(eventName, payload);

      if (!message) {
        return { sent: false, reason: 'no_template' };
      }

      const config = getConfig();

      if (!config.events.has(message.messageKey)) {
        return { sent: false, reason: 'event_filtered' };
      }

      if (!config.enabled) {
        console.info(`${logPrefix} (desactive) Message non envoye [${message.messageKey}] : "${message.text}"`);
        return { sent: false, reason: 'disabled' };
      }

      const problems = validate(config);

      if (problems.length > 0) {
        console.error(`${logPrefix} Configuration invalide, message ignore [${message.messageKey}] : ${problems.join(' ; ')}`);
        return { sent: false, reason: 'invalid_config' };
      }

      const { url, init } = buildRequest(config, message.text);
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(config.timeoutMs) });
      const body = await response.text().catch(() => '');

      if (!isSuccess(response, body)) {
        console.error(`${logPrefix} Refus du fournisseur (HTTP ${response.status}) pour commande #${message.orderId} [${message.messageKey}] : ${body.slice(0, 300)}`);
        return { sent: false, reason: 'provider_error', status: response.status };
      }

      console.info(`${logPrefix} Message publie pour commande #${message.orderId} [${message.messageKey}].`);
      return { sent: true };
    } catch (error) {
      const isTimeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
      const reason = isTimeout ? 'timeout' : 'network_error';
      const cause = error?.cause;
      const detail = isTimeout
        ? 'delai depasse'
        : (cause?.code || cause?.errors?.[0]?.code || cause?.message || error?.message || String(error));

      console.error(`${logPrefix} Echec de publication (${reason}) pour ${eventName} : ${detail}`);
      return { sent: false, reason };
    }
  };

  const describe = () => {
    const { enabled, events, timeoutMs } = getConfig();
    return `${logPrefix} Service initialise (${enabled ? 'actif' : 'desactive'}, delai ${timeoutMs} ms, cles : ${[...events].join(', ') || 'aucune'}).`;
  };

  return Object.freeze({ name, envPrefix, publish, describe, getConfig });
};
