// Mise en forme d'un produit pour les reseaux sociaux du marchand.
// Contenu : nom, prix en FCFA, description courte, lien direct vers la fiche produit publique, image.
// Uniquement des informations publiques du produit : aucune donnee client.
const DESCRIPTION_MAX = 200;
const TELEGRAM_CAPTION_MAX = 1024;

const trimSlash = (url) => String(url || '').trim().replace(/\/+$/, '');

// « 35 000 FCFA » (espaces simples, pour un affichage identique sur toutes les plateformes)
export const formatFcfa = (value) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
  .format(Number(value) || 0)
  .replace(/[  ]/g, ' ')} FCFA`;

const shortDescription = (text) => {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= DESCRIPTION_MAX) return clean;
  const cut = clean.slice(0, DESCRIPTION_MAX - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 120 ? cut.lastIndexOf(' ') : cut.length).trimEnd()}…`;
};

// Les reseaux sociaux telechargent l'image eux-memes : l'URL doit etre absolue et publique
const absoluteImageUrl = (imageUrl, backendUrl) => {
  if (!imageUrl) return null;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  return backendUrl ? `${trimSlash(backendUrl)}/${String(imageUrl).replace(/^\/+/, '')}` : null;
};

/**
 * @returns {{ title, text, caption, imageUrl, productUrl, priceLabel }}
 * text : message complet ; caption : version limitee a 1024 caracteres (legende Telegram).
 */
export const formatProductPost = (product, {
  frontendUrl = process.env.FRONTEND_URL,
  backendUrl = process.env.BACKEND_URL
} = {}) => {
  const productUrl = `${trimSlash(frontendUrl)}/produits/${product.id}`;
  const priceLabel = formatFcfa(product.price);
  const description = shortDescription(product.description);
  const lines = [product.name, priceLabel, ...(description ? ['', description] : []), '', `Commander : ${productUrl}`];
  const text = lines.join('\n');

  return {
    title: product.name,
    text,
    caption: text.length <= TELEGRAM_CAPTION_MAX ? text : `${text.slice(0, TELEGRAM_CAPTION_MAX - 1)}…`,
    imageUrl: absoluteImageUrl(product.image_url, backendUrl),
    productUrl,
    priceLabel
  };
};
