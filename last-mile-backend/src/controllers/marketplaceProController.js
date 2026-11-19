import { MarketplaceModel } from '../models/marketplaceModel.js';
import { normalizeTrackingCode } from '../utils/trackingCode.js';
import {
  createHttpError,
  paginationOf,
  readPagination,
  readPrice,
  readText,
  toProductCard,
  toRating
} from './marketplaceController.js';

// API « marketplace pro » (/api/marketplace) : filtres combines, autocompletion, fiches enrichies,
// avis clients verifies et vitrines de boutiques. Aucune donnee de contact ni donnee client exposee.

const PRO_SORTS = ['newest', 'price_asc', 'price_desc', 'top_rated'];
const SHOP_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SUGGESTION_MIN_LENGTH = 2;
const REVIEWS_SHOWN = 20;
// Meme message pour toute preuve d'achat invalide : on ne revele pas si un numero a commande
const REVIEW_NOT_ALLOWED = 'Seuls les clients dont la commande contenant ce produit a ete livree peuvent laisser un avis. Verifiez votre code de suivi ou votre numero.';

const parsePositiveId = (value, label) => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw createHttpError(`${label} invalide.`, 400);
  return id;
};

// « Jean Dupont » -> « Jean D. » : un avis public ne revele pas le nom complet
export const anonymizeName = (name) => {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'Client';
  const first = words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase();
  return words[1] ? `${first} ${words[1].charAt(0).toUpperCase()}.` : first;
};

const toPublicReview = (row) => ({
  id: row.id,
  author: anonymizeName(row.customer_name),
  rating: Number(row.rating),
  comment: row.comment,
  is_verified_purchase: Boolean(row.is_verified_purchase),
  created_at: row.created_at
});

const readProductFilters = (query) => {
  const sort = query.sort ? String(query.sort) : 'newest';
  if (!PRO_SORTS.includes(sort)) throw createHttpError(`Tri invalide (valeurs possibles : ${PRO_SORTS.join(', ')}).`, 400);

  const filters = {
    q: readText(query.q, 100, 'Recherche'),
    category: readText(query.category, 60, 'Categorie'),
    shop: null,
    merchantId: query.merchant_id === undefined || query.merchant_id === '' ? null : parsePositiveId(query.merchant_id, 'Identifiant de marchand'),
    minPrice: readPrice(query.min_price, 'Prix minimum'),
    maxPrice: readPrice(query.max_price, 'Prix maximum'),
    inStock: ['true', '1'].includes(String(query.in_stock || '').toLowerCase())
  };
  if (filters.minPrice !== null && filters.maxPrice !== null && filters.minPrice > filters.maxPrice) {
    throw createHttpError('Le prix minimum depasse le prix maximum.', 400);
  }
  return { filters, sort };
};

const echoFilters = (filters, sort) => ({
  q: filters.q,
  category: filters.category,
  merchant_id: filters.merchantId,
  min_price: filters.minPrice,
  max_price: filters.maxPrice,
  in_stock: filters.inStock,
  sort
});

// ---------- GET /api/marketplace/products ----------
export const listProducts = async (req, res, next) => {
  try {
    const { filters, sort } = readProductFilters(req.query);
    const pagination = readPagination(req.query);
    const { rows, total } = await MarketplaceModel.listProducts({ filters, sort, ...pagination });

    res.setHeader('Cache-Control', 'public, max-age=30');
    return res.status(200).json({ items: rows.map(toProductCard), pagination: paginationOf(pagination, total), filters: echoFilters(filters, sort) });
  } catch (error) {
    return next(error);
  }
};

// ---------- GET /api/marketplace/suggestions?q= ----------
export const getSuggestions = async (req, res, next) => {
  try {
    const q = readText(req.query.q, 100, 'Recherche');
    if (!q || q.length < SUGGESTION_MIN_LENGTH) {
      return res.status(200).json({ query: q || '', products: [], categories: [] });
    }

    const { products, categories } = await MarketplaceModel.suggest(q);
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).json({
      query: q,
      products: products.map((row) => ({
        id: row.id,
        name: row.name,
        price: Number(row.price),
        image_url: row.image_url,
        category: row.category,
        shop: { name: row.shop_name, slug: row.shop_slug }
      })),
      categories: categories.map((row) => ({ name: row.name, product_count: Number(row.product_count) }))
    });
  } catch (error) {
    return next(error);
  }
};

// ---------- GET /api/marketplace/products/:id ----------
export const getProductDetails = async (req, res, next) => {
  try {
    const productId = parsePositiveId(req.params.id, 'Identifiant de produit');
    const product = await MarketplaceModel.findProductById(productId);
    if (!product) throw createHttpError('Produit introuvable.', 404);

    const [reviews, breakdown, similar, shopProductCount] = await Promise.all([
      MarketplaceModel.listReviews(product.id, REVIEWS_SHOWN),
      MarketplaceModel.ratingBreakdown(product.id),
      MarketplaceModel.listSimilarProducts(product),
      MarketplaceModel.countShopProducts(product.merchant_id)
    ]);
    const distribution = Object.fromEntries([5, 4, 3, 2, 1].map((stars) => [stars, Number(breakdown.find((row) => Number(row.rating) === stars)?.total || 0)]));

    res.setHeader('Cache-Control', 'public, max-age=30');
    return res.status(200).json({
      product: {
        ...toProductCard(product),
        description: product.description,
        created_at: product.created_at,
        shop: {
          id: product.merchant_id,
          name: product.shop_name,
          slug: product.shop_slug,
          avatar: product.shop_avatar,
          verified: Boolean(product.shop_verified),
          // Boutique en pause : la fiche reste visible, la commande est refusee
          paused: product.shop_status === 'paused',
          product_count: shopProductCount
        }
      },
      avg_rating: toRating(product.avg_rating),
      review_count: Number(product.review_count || 0),
      rating_distribution: distribution,
      reviews: reviews.map(toPublicReview),
      similar_products: similar.map(toProductCard)
    });
  } catch (error) {
    return next(error);
  }
};

// ---------- POST /api/marketplace/products/:id/reviews ----------
// Preuve d'achat : code de suivi (recommande) ou numero de telephone de la commande livree.
export const createReview = async (req, res, next) => {
  try {
    const productId = parsePositiveId(req.params.id, 'Identifiant de produit');
    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw createHttpError('La note doit etre un entier de 1 a 5.', 400);

    const customerName = typeof req.body.customer_name === 'string' ? req.body.customer_name.trim() : '';
    if (customerName.length < 2 || customerName.length > 60) throw createHttpError('Nom requis (2 a 60 caracteres).', 400);

    const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : '';
    if (comment.length > 1000) throw createHttpError('Commentaire trop long (1000 caracteres maximum).', 400);

    const rawCode = typeof req.body.tracking_code === 'string' ? req.body.tracking_code.trim() : '';
    const trackingCode = rawCode ? normalizeTrackingCode(rawCode) : null;
    if (rawCode && !trackingCode) throw createHttpError('Code de suivi invalide (format attendu : LM-XXXX-XXXX).', 400);
    const phoneDigits = typeof req.body.phone === 'string' ? req.body.phone.replace(/\D/g, '') : '';
    if (!trackingCode && phoneDigits.length < 9) {
      throw createHttpError('Indiquez votre code de suivi (LM-XXXX-XXXX) ou le numero de telephone de la commande.', 400);
    }

    const product = await MarketplaceModel.findProductById(productId);
    if (!product) throw createHttpError('Produit introuvable.', 404);

    const order = await MarketplaceModel.findDeliveredOrderForReview({
      productId,
      trackingCode,
      phoneDigits: trackingCode ? null : phoneDigits.slice(-9)
    });
    if (!order) throw createHttpError(REVIEW_NOT_ALLOWED, 403);

    let review;
    try {
      review = await MarketplaceModel.insertReview({
        productId,
        orderId: order.id,
        customerName,
        // Minimisation : le numero n'est conserve que s'il a servi de preuve ; jamais renvoye par l'API
        customerPhone: trackingCode ? null : phoneDigits.slice(-9),
        rating,
        comment: comment || null
      });
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') throw createHttpError('Vous avez deja donne votre avis sur ce produit pour cette commande.', 409);
      throw error;
    }

    return res.status(201).json({ review: toPublicReview(review) });
  } catch (error) {
    return next(error);
  }
};

// ---------- GET /api/marketplace/shops/:slug ----------
export const getShopShowcase = async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    if (!SHOP_SLUG_PATTERN.test(slug) || slug.length > 120) throw createHttpError('Identifiant de boutique invalide.', 400);

    const shop = await MarketplaceModel.findShopProfile(slug);
    if (!shop) throw createHttpError('Boutique introuvable.', 404);

    const { filters, sort } = readProductFilters({ ...req.query, merchant_id: undefined });
    const pagination = readPagination(req.query);
    const { rows, total } = await MarketplaceModel.listProducts({ filters: { ...filters, shop: slug }, sort, ...pagination });

    res.setHeader('Cache-Control', 'public, max-age=30');
    return res.status(200).json({
      shop: {
        id: shop.id,
        name: shop.name,
        slug: shop.shop_slug,
        avatar: shop.avatar,
        description: shop.shop_description,
        verified: Boolean(shop.is_verified),
        paused: shop.shop_status === 'paused',
        member_since: shop.created_at,
        product_count: Number(shop.product_count),
        in_stock_count: Number(shop.in_stock_count),
        avg_rating: toRating(shop.avg_rating),
        review_count: Number(shop.review_count),
        // Statistique de livraison publique (agregat, aucune donnee de commande)
        deliveries_completed: Number(shop.deliveries_completed)
      },
      products: { items: rows.map(toProductCard), pagination: paginationOf(pagination, total), sort }
    });
  } catch (error) {
    return next(error);
  }
};
