import { MarketplaceModel, PRODUCT_SORTS } from '../models/marketplaceModel.js';
import { normalizeTrackingCode } from '../utils/trackingCode.js';

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 48;
const MAX_PAGE = 1000;
const SHOP_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DESCRIPTION_EXCERPT_LENGTH = 160;

// Etapes affichees par la barre de progression du suivi public
const TRACKING_STEPS = ['pending', 'assigned', 'picking', 'in_transit', 'delivered'];
const FINAL_STATUSES = new Set(['delivered', 'failed', 'cancelled']);

export const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// ---------- Lecture et validation des parametres (reutilises par marketplaceProController) ----------
export const readText = (value, maxLength, label) => {
  if (value === undefined || value === '') return null;
  const text = String(value).trim();
  if (text.length > maxLength) throw createHttpError(`${label} trop long (${maxLength} caracteres maximum).`, 400);
  return text || null;
};

const readPositiveInt = (value, fallback, max, label) => {
  if (value === undefined || value === '') return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw createHttpError(`${label} invalide.`, 400);
  return Math.min(number, max);
};

export const readPrice = (value, label) => {
  if (value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw createHttpError(`${label} invalide.`, 400);
  return number;
};

export const readPagination = (query) => ({
  page: readPositiveInt(query.page, 1, MAX_PAGE, 'Numero de page'),
  // Au-dela du maximum, la taille est ramenee a 48 plutot que refusee
  limit: readPositiveInt(query.limit, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, 'Taille de page')
});

export const paginationOf = ({ page, limit }, total) => ({ page, limit, total, total_pages: Math.ceil(total / limit) });

// Note moyenne arrondie a une decimale (null sans avis)
export const toRating = (value) => (value === null || value === undefined ? null : Math.round(Number(value) * 10) / 10);

// ---------- Mise en forme (liste blanche de champs) ----------
const excerpt = (text) => {
  if (!text) return null;
  return text.length > DESCRIPTION_EXCERPT_LENGTH ? `${text.slice(0, DESCRIPTION_EXCERPT_LENGTH - 1).trimEnd()}…` : text;
};

const toShopSummary = (row) => ({ name: row.shop_name, slug: row.shop_slug, avatar: row.shop_avatar, verified: Boolean(row.shop_verified) });

export const toProductCard = (row) => ({
  id: row.id,
  name: row.name,
  description: excerpt(row.description),
  category: row.category,
  price: Number(row.price),
  image_url: row.image_url,
  stock: Number(row.stock),
  in_stock: Number(row.stock) > 0,
  avg_rating: toRating(row.avg_rating),
  review_count: Number(row.review_count || 0),
  shop: toShopSummary(row)
});

const toShopCard = (row) => ({
  name: row.name,
  slug: row.shop_slug,
  avatar: row.avatar,
  verified: Boolean(row.is_verified),
  product_count: Number(row.product_count),
  in_stock_count: Number(row.in_stock_count),
  min_price: row.min_price === null ? null : Number(row.min_price)
});

const setListCache = (res) => res.setHeader('Cache-Control', 'public, max-age=30');

// ---------- GET /api/public/marketplace ----------
export const getMarketplaceHome = async (req, res, next) => {
  try {
    const [latest, shops, categories, stats] = await Promise.all([
      MarketplaceModel.listProducts({
        filters: { q: null, category: null, shop: null, minPrice: null, maxPrice: null, inStock: true },
        sort: 'recent', page: 1, limit: 8
      }),
      MarketplaceModel.listShops({ q: null, page: 1, limit: 6 }),
      MarketplaceModel.listCategories(),
      MarketplaceModel.getStats()
    ]);

    setListCache(res);
    return res.status(200).json({
      latest_products: latest.rows.map(toProductCard),
      featured_shops: shops.rows.map(toShopCard),
      categories: categories.map((c) => ({ name: c.name, product_count: Number(c.product_count) })),
      stats: {
        shop_count: Number(stats.shop_count),
        products_in_stock: Number(stats.products_in_stock),
        deliveries_completed: Number(stats.deliveries_completed)
      }
    });
  } catch (error) {
    return next(error);
  }
};

// ---------- GET /api/public/products ----------
export const listProducts = async (req, res, next) => {
  try {
    const sort = req.query.sort ? String(req.query.sort) : 'recent';
    if (!PRODUCT_SORTS.includes(sort)) {
      throw createHttpError(`Tri invalide (valeurs possibles : ${PRODUCT_SORTS.join(', ')}).`, 400);
    }

    const shop = readText(req.query.shop, 120, 'Identifiant de boutique');
    if (shop && !SHOP_SLUG_PATTERN.test(shop)) throw createHttpError('Identifiant de boutique invalide.', 400);

    const filters = {
      q: readText(req.query.q, 100, 'Recherche'),
      category: readText(req.query.category, 60, 'Categorie'),
      shop,
      minPrice: readPrice(req.query.min_price, 'Prix minimum'),
      maxPrice: readPrice(req.query.max_price, 'Prix maximum'),
      inStock: ['true', '1'].includes(String(req.query.in_stock || '').toLowerCase())
    };
    if (filters.minPrice !== null && filters.maxPrice !== null && filters.minPrice > filters.maxPrice) {
      throw createHttpError('Le prix minimum depasse le prix maximum.', 400);
    }

    const pagination = readPagination(req.query);
    const { rows, total } = await MarketplaceModel.listProducts({ filters, sort, ...pagination });

    setListCache(res);
    return res.status(200).json({
      items: rows.map(toProductCard),
      pagination: paginationOf(pagination, total),
      filters: {
        q: filters.q,
        category: filters.category,
        shop: filters.shop,
        min_price: filters.minPrice,
        max_price: filters.maxPrice,
        in_stock: filters.inStock,
        sort
      }
    });
  } catch (error) {
    return next(error);
  }
};

// ---------- GET /api/public/products/:id ----------
export const getProduct = async (req, res, next) => {
  try {
    const productId = Number(req.params.id);
    if (!Number.isSafeInteger(productId) || productId < 1) throw createHttpError('Identifiant de produit invalide.', 400);

    const product = await MarketplaceModel.findProductById(productId);
    if (!product) throw createHttpError('Produit introuvable.', 404);

    const related = await MarketplaceModel.listRelatedProducts(product.shop_slug, product.id);

    setListCache(res);
    return res.status(200).json({
      product: { ...toProductCard(product), description: product.description, created_at: product.created_at },
      related_products: related.map(toProductCard)
    });
  } catch (error) {
    return next(error);
  }
};

// ---------- GET /api/public/shops ----------
export const listShops = async (req, res, next) => {
  try {
    const q = readText(req.query.q, 100, 'Recherche');
    const pagination = readPagination(req.query);
    const { rows, total } = await MarketplaceModel.listShops({ q, ...pagination });

    setListCache(res);
    return res.status(200).json({ items: rows.map(toShopCard), pagination: paginationOf(pagination, total) });
  } catch (error) {
    return next(error);
  }
};

// ---------- GET /api/public/tracking/:code ----------
export const trackParcel = async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const code = normalizeTrackingCode(req.params.code);
    if (!code) throw createHttpError('Code de suivi invalide (format attendu : LM-XXXX-XXXX).', 400);

    const tracking = await MarketplaceModel.findTrackingByCode(code);
    // Une commande de boutique non payee n'est pas suivable : meme reponse qu'un code inconnu
    const isUnpaidShopOrder = tracking?.order.payment_method && tracking.order.payment_status !== 'paid';
    if (!tracking || isUnpaidShopOrder) throw createHttpError('Aucun colis ne correspond a ce code de suivi.', 404);

    const { order, history } = tracking;
    // picked_up est une etape intermediaire entre picking et in_transit ;
    // echec et annulation ne sont pas des etapes de la barre (index -1)
    const stepStatus = order.status === 'picked_up' ? 'picking' : order.status;
    const currentStepIndex = TRACKING_STEPS.indexOf(stepStatus);

    // Liste blanche stricte : aucun identifiant interne, aucune donnee client, aucune donnee livreur
    return res.status(200).json({
      tracking_code: order.tracking_code,
      status: order.status,
      is_final: FINAL_STATUSES.has(order.status),
      progress: { steps: TRACKING_STEPS, current_step_index: currentStepIndex },
      shop: { name: order.shop_name, slug: order.shop_slug },
      created_at: order.created_at,
      updated_at: order.updated_at,
      history: history.map((entry) => ({ status: entry.status, at: entry.at }))
    });
  } catch (error) {
    return next(error);
  }
};
