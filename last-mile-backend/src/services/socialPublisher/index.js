import { SocialChannelModel } from '../../models/socialChannelModel.js';
import { decryptJson } from '../../utils/secretBox.js';
import { formatProductPost } from './formatProductPost.js';
import { scrubSecrets } from './httpClient.js';
import { PLATFORMS, secretValuesOf } from './platforms.js';

// Social commerce : diffusion d'un produit sur les canaux PROPRES du marchand (et uniquement les siens).
// Distinct des notifications logistiques globales (src/services/notifications/), qui restent inchangees.
const LOG_PREFIX = '[SocialPublisher]';

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const publishOnChannel = async (channel, post) => {
  const report = { channel_id: channel.id, platform: channel.platform, channel_name: channel.channel_name };
  let secrets = [];

  try {
    const credentials = decryptJson(channel.credentials_json);
    secrets = secretValuesOf(channel.platform, credentials);
    const { externalPostId } = await PLATFORMS[channel.platform].publish({ credentials, post });
    return { ...report, status: 'sent', external_post_id: externalPostId ?? null, error: null };
  } catch (error) {
    const message = error?.name === 'PublishError'
      ? error.message
      : (error?.code === 'ERR_CRYPTO_INVALID_TAG' || /decrypt|auth/i.test(error?.message || '')
        ? 'Identifiants illisibles : la cle de chiffrement du serveur a peut-etre change. Ressaisissez le jeton.'
        : `Erreur interne : ${error?.message || error}`);
    // Ceinture et bretelles : aucun secret ne doit sortir, meme d'une erreur inattendue
    return { ...report, status: 'failed', external_post_id: null, error: scrubSecrets(message, secrets) };
  }
};

/**
 * Publie un produit du marchand sur ses canaux actifs.
 * trigger : 'manual' (tous les canaux actifs) ou 'auto' (canaux actifs avec auto_publish).
 * Chaque canal est traite independamment : un echec n'empeche pas les autres publications.
 */
export const publishProduct = async ({ merchantId, productId, trigger = 'manual' }) => {
  const product = await SocialChannelModel.findMerchantProduct(productId, merchantId);
  if (!product) {
    throw createHttpError('Produit introuvable.', 404);
  }

  const channels = await SocialChannelModel.listPublishable(merchantId, { autoOnly: trigger === 'auto' });
  const post = formatProductPost(product);
  const results = await Promise.all(channels.map((channel) => publishOnChannel(channel, post)));

  await Promise.all(results.map((result) => SocialChannelModel.recordPost({
    productId: product.id,
    merchantId,
    channelId: result.channel_id,
    platform: result.platform,
    status: result.status,
    externalPostId: result.external_post_id,
    errorMessage: result.error
  })));

  const sent = results.filter((result) => result.status === 'sent').length;
  if (results.length) {
    const failures = results.filter((r) => r.status === 'failed').map((r) => `${r.platform} #${r.channel_id}`).join(', ');
    console.info(`${LOG_PREFIX} Produit #${product.id} (marchand #${merchantId}, ${trigger}) : ${sent}/${results.length} publication(s) reussie(s)${failures ? ` ; echecs : ${failures}` : ''}.`);
  }

  return {
    product_id: product.id,
    trigger,
    total: results.length,
    sent,
    failed: results.length - sent,
    results
  };
};

/**
 * Publication automatique apres la creation d'un produit : asynchrone et non bloquante.
 * La reponse HTTP de creation du produit n'attend jamais les reseaux sociaux.
 */
export const scheduleAutoPublish = (merchantId, productId) => {
  setImmediate(() => {
    publishProduct({ merchantId, productId, trigger: 'auto' })
      .catch((error) => console.error(`${LOG_PREFIX} Publication automatique du produit #${productId} impossible : ${error.message}`));
  });
};
