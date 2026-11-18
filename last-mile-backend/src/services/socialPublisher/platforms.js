import { publishToLinkedIn } from './linkedinPublisher.js';
import { publishToFacebook, publishToInstagram } from './metaPublisher.js';
import { publishToTelegram } from './telegramPublisher.js';
import { publishToWhapi } from './whapiPublisher.js';

// Registre des plateformes : champs d'identification attendus, validation, champs secrets, adaptateur.
// Ajouter une plateforme = une entree ici (+ son adaptateur) ; le reste du module ne change pas.
// Aucune URL n'est saisie par le marchand : les adresses des API sont fixees par le serveur (anti-SSRF).
export const PLATFORMS = Object.freeze({
  whatsapp: {
    label: 'WhatsApp (Whapi)',
    fields: {
      token: { secret: true, pattern: /^\S{10,200}$/, hint: 'jeton API Whapi.cloud' },
      channel_id: { pattern: /^\d{5,30}@newsletter$/, hint: 'identifiant de chaine de la forme <id>@newsletter' }
    },
    publish: publishToWhapi
  },
  telegram: {
    label: 'Telegram',
    fields: {
      bot_token: { secret: true, pattern: /^\d{5,15}:[\w-]{20,}$/, hint: 'jeton du bot de la forme 123456:ABC...' },
      chat_id: { pattern: /^(@\w{5,32}|-?\d{5,20})$/, hint: '@nom_du_canal ou identifiant numerique -100...' }
    },
    publish: publishToTelegram
  },
  facebook: {
    label: 'Facebook',
    fields: {
      page_id: { pattern: /^\d{5,30}$/, hint: 'identifiant numerique de la page' },
      page_access_token: { secret: true, pattern: /^\S{20,1000}$/, hint: 'jeton d\'acces de la page' }
    },
    publish: publishToFacebook
  },
  instagram: {
    label: 'Instagram',
    fields: {
      ig_user_id: { pattern: /^\d{5,30}$/, hint: 'identifiant numerique du compte Instagram professionnel' },
      access_token: { secret: true, pattern: /^\S{20,1000}$/, hint: 'jeton d\'acces (permission instagram_content_publish)' }
    },
    publish: publishToInstagram
  },
  linkedin: {
    label: 'LinkedIn',
    fields: {
      organization_urn: { pattern: /^urn:li:organization:\d{1,20}$/, hint: 'urn:li:organization:<id> (page entreprise uniquement)' },
      access_token: { secret: true, pattern: /^\S{20,2000}$/, hint: 'jeton d\'acces (permission w_organization_social)' }
    },
    publish: publishToLinkedIn
  }
});

export const PLATFORM_NAMES = Object.freeze(Object.keys(PLATFORMS));

const MASK = '••••••••';
const isMaskedValue = (value) => typeof value === 'string' && value.startsWith('•');

/** Secrets masques : « ••••••••3BGUV » (5 derniers caracteres si le secret est assez long). */
export const maskSecret = (value) => {
  const text = String(value ?? '');
  return text.length >= 12 ? `${MASK}${text.slice(-5)}` : MASK;
};

export const maskCredentials = (platform, credentials) => Object.fromEntries(
  Object.entries(PLATFORMS[platform].fields).map(([field, rule]) => [
    field,
    rule.secret ? maskSecret(credentials?.[field]) : credentials?.[field] ?? null
  ])
);

export const secretValuesOf = (platform, credentials) => Object.entries(PLATFORMS[platform].fields)
  .filter(([, rule]) => rule.secret)
  .map(([field]) => credentials?.[field])
  .filter(Boolean);

/**
 * Valide les identifiants saisis. Pour une mise a jour, un secret omis ou renvoye masque (« •••• »)
 * conserve la valeur enregistree : l'interface n'a jamais besoin de connaitre le jeton en clair.
 * Les champs inconnus sont ignores. Renvoie { credentials, errors }.
 */
export const normalizeCredentials = (platform, input = {}, existing = null) => {
  const errors = [];
  const credentials = {};

  for (const [field, rule] of Object.entries(PLATFORMS[platform].fields)) {
    const raw = typeof input?.[field] === 'string' ? input[field].trim() : '';
    const keepExisting = existing && rule.secret && (!raw || isMaskedValue(raw));
    const value = keepExisting ? existing[field] : (raw || existing?.[field] || '');

    if (!value || !rule.pattern.test(value)) {
      errors.push(`${field} : ${rule.hint}`);
    } else {
      credentials[field] = value;
    }
  }

  return { credentials, errors };
};
