// Parametres du compte connecte (/api/settings) : profil, boutique (marchand), mot de passe,
// sessions et preferences de notifications. Validation stricte : tout champ invalide => 400.
import bcrypt from 'bcrypt';
import SettingsModel from '../models/settingsModel.js';
import { bumpTokenVersion } from '../services/tokenVersionService.js';
import { signSessionToken } from '../utils/authToken.js';

const BCRYPT_ROUNDS = 10;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^\+?[0-9][0-9 .-]{7,19}$/;
// Identifiant d'URL : minuscules, chiffres et tirets, 3 a 60 caracteres, sans tiret en debut ou fin
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,58})[a-z0-9]$/;
const SHOP_STATUSES = ['open', 'paused'];
const LANGUAGES = ['fr', 'en'];

export const NOTIFICATION_EVENTS = ['new_order', 'order_status', 'payment_received', 'daily_summary'];
export const NOTIFICATION_CHANNELS = ['email', 'push'];
const DEFAULT_PREFS = {
  new_order: { email: true, push: true },
  order_status: { email: false, push: true },
  payment_received: { email: false, push: true },
  daily_summary: { email: false, push: false }
};

const httpError = (message, statusCode, code) => Object.assign(new Error(message), { statusCode, code });

// ---------- Lecture et validation des champs ----------
const readString = (value, label, { min = 0, max, optional = false } = {}) => {
  if (value === undefined || value === null || (optional && value === '')) {
    if (optional) return null;
    throw httpError(`${label} est requis.`, 400);
  }
  if (typeof value !== 'string') throw httpError(`${label} est invalide.`, 400);
  const trimmed = value.trim();
  if (!optional && trimmed.length < Math.max(min, 1)) throw httpError(`${label} est requis.`, 400);
  if (trimmed.length < min) throw httpError(`${label} doit contenir au moins ${min} caracteres.`, 400);
  if (trimmed.length > max) throw httpError(`${label} ne doit pas depasser ${max} caracteres.`, 400);
  return optional && !trimmed ? null : trimmed;
};

/** Mot de passe robuste : 10 caracteres minimum, minuscule, majuscule, chiffre et symbole. */
export const checkPasswordStrength = (password) => {
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) return false;
  return /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
};

const readNotificationPrefs = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw httpError('Preferences de notifications invalides.', 400);
  const unknown = Object.keys(input).filter((key) => !NOTIFICATION_EVENTS.includes(key));
  if (unknown.length) throw httpError(`Evenement de notification inconnu : ${unknown.join(', ')}.`, 400);

  return Object.fromEntries(NOTIFICATION_EVENTS.map((event) => {
    const channels = input[event] ?? DEFAULT_PREFS[event];
    if (!channels || typeof channels !== 'object' || Array.isArray(channels)) throw httpError(`Preferences invalides pour ${event}.`, 400);
    const unknownChannels = Object.keys(channels).filter((key) => !NOTIFICATION_CHANNELS.includes(key));
    if (unknownChannels.length) throw httpError(`Canal de notification inconnu : ${unknownChannels.join(', ')}.`, 400);
    return [event, Object.fromEntries(NOTIFICATION_CHANNELS.map((channel) => {
      const value = channels[channel] ?? DEFAULT_PREFS[event][channel];
      if (typeof value !== 'boolean') throw httpError(`Valeur invalide pour ${event}.${channel} (true ou false attendu).`, 400);
      return [channel, value];
    }))];
  }));
};

const parseStoredPrefs = (stored) => {
  if (!stored) return DEFAULT_PREFS;
  try {
    return readNotificationPrefs(typeof stored === 'string' ? JSON.parse(stored) : stored);
  } catch {
    return DEFAULT_PREFS;
  }
};

// ---------- Reponse ----------
const toSettings = (user) => ({
  profile: {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    avatar: user.avatar || null,
    member_since: user.created_at,
    // Connexion precedant la session en cours (la courante est la connexion actuelle)
    last_login_at: user.previous_login_at || null,
    current_login_at: user.last_login_at || null
  },
  shop: user.role === 'merchant' ? {
    name: user.shop_name || user.name,
    slug: user.shop_slug,
    description: user.shop_description || '',
    pickup_address: user.pickup_address || '',
    default_city: user.default_city || '',
    status: user.shop_status || 'open',
    verified: Boolean(user.is_verified)
  } : null,
  notifications: parseStoredPrefs(user.notification_prefs),
  language: LANGUAGES.includes(user.ui_language) ? user.ui_language : null
});

const loadUser = async (userId) => {
  const user = await SettingsModel.findById(userId);
  if (!user) throw httpError('Utilisateur introuvable.', 404);
  return user;
};

// ---------- GET /api/settings/profile ----------
export const getSettings = async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(toSettings(await loadUser(req.user.id)));
  } catch (error) {
    return next(error);
  }
};

// ---------- PUT /api/settings/profile ----------
export const updateSettingsProfile = async (req, res, next) => {
  try {
    const user = await loadUser(req.user.id);
    const body = req.body || {};

    const profile = {
      name: readString(body.name, 'Le nom', { min: 2, max: 80 }),
      email: readString(body.email, "L'adresse e-mail", { max: 160 }).toLowerCase(),
      phone: readString(body.phone, 'Le telephone', { max: 25 })
    };
    if (!EMAIL_PATTERN.test(profile.email)) throw httpError("L'adresse e-mail est invalide.", 400);
    if (!PHONE_PATTERN.test(profile.phone)) throw httpError('Le numero de telephone est invalide.', 400);

    let shop = null;
    if (body.shop !== undefined && body.shop !== null) {
      if (user.role !== 'merchant') throw httpError('Les parametres de boutique sont reserves aux marchands.', 403);
      if (typeof body.shop !== 'object' || Array.isArray(body.shop)) throw httpError('Parametres de boutique invalides.', 400);
      shop = {
        name: readString(body.shop.name, 'Le nom de la boutique', { min: 2, max: 120 }),
        slug: readString(body.shop.slug, "L'adresse de la boutique", { max: 60 }).toLowerCase(),
        description: readString(body.shop.description ?? '', 'La description', { max: 1000, optional: true }),
        pickup_address: readString(body.shop.pickup_address ?? '', "L'adresse de retrait", { max: 255, optional: true }),
        default_city: readString(body.shop.default_city ?? '', 'La ville', { max: 60, optional: true }),
        status: body.shop.status ?? 'open'
      };
      if (!SLUG_PATTERN.test(shop.slug)) {
        throw httpError("L'adresse de la boutique doit contenir 3 a 60 caracteres : lettres minuscules, chiffres et tirets.", 400);
      }
      if (!SHOP_STATUSES.includes(shop.status)) throw httpError('Statut de boutique invalide (open ou paused).', 400);
    }

    if (await SettingsModel.isEmailTaken(profile.email, user.id)) throw httpError('Cette adresse e-mail est deja utilisee.', 409, 'EMAIL_TAKEN');
    if (shop && await SettingsModel.isSlugTaken(shop.slug, user.id)) throw httpError('Cette adresse de boutique est deja prise.', 409, 'SLUG_TAKEN');

    try {
      await SettingsModel.updateProfile(user.id, profile, shop);
    } catch (error) {
      // Course entre deux mises a jour simultanees : l'index unique tranche
      if (error.code === 'ER_DUP_ENTRY') {
        throw httpError(String(error.message).includes('shop_slug') ? 'Cette adresse de boutique est deja prise.' : 'Cette adresse e-mail est deja utilisee.', 409);
      }
      throw error;
    }

    return res.status(200).json({ message: 'Parametres enregistres.', ...toSettings(await loadUser(user.id)) });
  } catch (error) {
    return next(error);
  }
};

// ---------- PUT /api/settings/password ----------
export const updatePassword = async (req, res, next) => {
  try {
    const { current_password: currentPassword, new_password: newPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || !currentPassword || typeof newPassword !== 'string') {
      throw httpError('Mot de passe actuel et nouveau mot de passe requis.', 400);
    }

    const hash = await SettingsModel.findPasswordHash(req.user.id);
    if (!hash) throw httpError('Utilisateur introuvable.', 404);
    // 400 et non 401 : une erreur de saisie ne doit pas deconnecter l'utilisateur
    if (!await bcrypt.compare(currentPassword, hash)) {
      throw httpError('Le mot de passe actuel est incorrect.', 400, 'INVALID_CURRENT_PASSWORD');
    }
    if (!checkPasswordStrength(newPassword)) {
      throw httpError('Le nouveau mot de passe doit contenir au moins 10 caracteres, dont une minuscule, une majuscule, un chiffre et un symbole.', 400, 'WEAK_PASSWORD');
    }
    if (await bcrypt.compare(newPassword, hash)) {
      throw httpError("Le nouveau mot de passe doit etre different de l'actuel.", 400, 'SAME_PASSWORD');
    }

    await SettingsModel.updatePassword(req.user.id, await bcrypt.hash(newPassword, BCRYPT_ROUNDS));
    // Les autres sessions sont deconnectees ; la session courante recoit un nouveau jeton
    const version = await bumpTokenVersion(req.user.id);
    return res.status(200).json({ message: 'Mot de passe modifie. Les autres sessions ont ete deconnectees.', token: signSessionToken(req.user, version) });
  } catch (error) {
    return next(error);
  }
};

// ---------- POST /api/settings/sessions/revoke-others ----------
export const revokeOtherSessions = async (req, res, next) => {
  try {
    await loadUser(req.user.id);
    const version = await bumpTokenVersion(req.user.id);
    return res.status(200).json({ message: 'Toutes les autres sessions ont ete deconnectees.', token: signSessionToken(req.user, version) });
  } catch (error) {
    return next(error);
  }
};

// ---------- PUT /api/settings/notifications ----------
export const updateNotificationSettings = async (req, res, next) => {
  try {
    const body = req.body || {};
    const notifications = readNotificationPrefs(body.notifications);
    let language = null;
    if (body.language !== undefined && body.language !== null) {
      if (!LANGUAGES.includes(body.language)) throw httpError('Langue invalide (fr ou en).', 400);
      language = body.language;
    } else {
      language = (await loadUser(req.user.id)).ui_language || null;
    }

    await SettingsModel.updatePreferences(req.user.id, notifications, language);
    return res.status(200).json({ message: 'Preferences enregistrees.', ...toSettings(await loadUser(req.user.id)) });
  } catch (error) {
    return next(error);
  }
};
