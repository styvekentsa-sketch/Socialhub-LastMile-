import { MAX_CHANNELS_PER_MERCHANT, SocialChannelModel } from '../models/socialChannelModel.js';
import { publishProduct } from '../services/socialPublisher/index.js';
import { maskCredentials, normalizeCredentials, PLATFORM_NAMES, PLATFORMS } from '../services/socialPublisher/platforms.js';
import { decryptJson, encryptJson } from '../utils/secretBox.js';

// Canaux sociaux du marchand connecte (req.user.id). Aucune route ne renvoie un secret en clair.

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const parseId = (value) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const parseBoolean = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  if ([true, 1, '1', 'true'].includes(value)) return true;
  if ([false, 0, '0', 'false'].includes(value)) return false;
  throw createHttpError('Valeur booleenne invalide (auto_publish, is_active).', 400);
};

const readCredentials = (channel) => {
  try {
    return decryptJson(channel.credentials_json);
  } catch {
    return null;
  }
};

// Representation publique d'un canal : identifiants non secrets visibles, secrets masques
const toPublicChannel = (channel) => {
  const credentials = readCredentials(channel);
  return {
    id: channel.id,
    platform: channel.platform,
    platform_label: PLATFORMS[channel.platform].label,
    channel_name: channel.channel_name,
    auto_publish: Boolean(channel.auto_publish),
    is_active: Boolean(channel.is_active),
    credentials: credentials ? maskCredentials(channel.platform, credentials) : null,
    // Identifiants illisibles (cle de chiffrement changee) : le marchand doit les ressaisir
    credentials_unreadable: credentials === null,
    created_at: channel.created_at,
    updated_at: channel.updated_at
  };
};

// ---------- GET /api/merchant/channels ----------
export const listChannels = async (req, res, next) => {
  try {
    const channels = await SocialChannelModel.listByMerchant(req.user.id);
    return res.status(200).json({ platforms: PLATFORM_NAMES, channels: channels.map(toPublicChannel) });
  } catch (error) {
    return next(error);
  }
};

// ---------- POST /api/merchant/channels (creation, ou mise a jour si body.id) ----------
export const saveChannel = async (req, res, next) => {
  try {
    const channelId = req.body.id === undefined || req.body.id === null ? null : parseId(req.body.id);
    if (req.body.id !== undefined && req.body.id !== null && !channelId) throw createHttpError('Identifiant de canal invalide.', 400);

    const existing = channelId ? await SocialChannelModel.findOwned(channelId, req.user.id) : null;
    // Canal d'un autre marchand ou inexistant : meme reponse (ne revele pas l'existence du canal)
    if (channelId && !existing) throw createHttpError('Canal introuvable.', 404);

    const platform = existing ? existing.platform : String(req.body.platform || '').trim().toLowerCase();
    if (!PLATFORMS[platform]) throw createHttpError(`Plateforme invalide (valeurs possibles : ${PLATFORM_NAMES.join(', ')}).`, 400);
    if (existing && req.body.platform && String(req.body.platform).toLowerCase() !== existing.platform) {
      throw createHttpError('La plateforme d\'un canal ne peut pas etre modifiee : creez un nouveau canal.', 400);
    }

    const channelName = typeof req.body.channel_name === 'string' ? req.body.channel_name.trim() : existing?.channel_name || '';
    if (!channelName || channelName.length > 100) throw createHttpError('Nom du canal requis (100 caracteres maximum).', 400);

    const previousCredentials = existing ? readCredentials(existing) : null;
    const { credentials, errors } = normalizeCredentials(platform, req.body.credentials, previousCredentials);
    if (errors.length) throw createHttpError(`Identifiants ${PLATFORMS[platform].label} invalides : ${errors.join(' ; ')}`, 400);

    const values = {
      platform,
      channelName,
      credentialsJson: encryptJson(credentials),
      autoPublish: parseBoolean(req.body.auto_publish, existing ? Boolean(existing.auto_publish) : false),
      isActive: parseBoolean(req.body.is_active, existing ? Boolean(existing.is_active) : true)
    };

    if (existing) {
      const updated = await SocialChannelModel.update(existing.id, req.user.id, values);
      return res.status(200).json({ channel: toPublicChannel(updated) });
    }

    if (await SocialChannelModel.countByMerchant(req.user.id) >= MAX_CHANNELS_PER_MERCHANT) {
      throw createHttpError(`Nombre maximal de canaux atteint (${MAX_CHANNELS_PER_MERCHANT}).`, 409);
    }
    const created = await SocialChannelModel.create(req.user.id, values);
    return res.status(201).json({ channel: toPublicChannel(created) });
  } catch (error) {
    return next(error);
  }
};

// ---------- DELETE /api/merchant/channels/:id ----------
export const deleteChannel = async (req, res, next) => {
  try {
    const channelId = parseId(req.params.id);
    if (!channelId) throw createHttpError('Identifiant de canal invalide.', 400);
    if (!(await SocialChannelModel.remove(channelId, req.user.id))) throw createHttpError('Canal introuvable.', 404);
    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
};

// ---------- POST /api/merchant/products/:id/publish ----------
export const publishProductNow = async (req, res, next) => {
  try {
    const productId = parseId(req.params.id);
    if (!productId) throw createHttpError('Identifiant de produit invalide.', 400);

    const report = await publishProduct({ merchantId: req.user.id, productId, trigger: 'manual' });
    return res.status(200).json({
      ...report,
      message: report.total ? `${report.sent}/${report.total} publication(s) reussie(s).` : 'Aucun canal actif : configurez un canal avant de publier.'
    });
  } catch (error) {
    return next(error);
  }
};
