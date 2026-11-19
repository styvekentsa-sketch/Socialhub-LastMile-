import pool from '../config/db.js';

// Requetes de la marketplace publique.
// REGLE : aucune donnee de contact (telephone, email) des marchands, aucune donnee client ni livreur.
// Seules les boutiques actives (marchand avec un shop_slug) sont visibles.

const PRODUCT_COLUMNS = `
  p.id, p.merchant_id, p.name, p.description, p.category, p.price, p.image_url, p.stock, p.created_at,
  COALESCE(NULLIF(u.shop_name, ''), u.name) AS shop_name, u.shop_slug, u.avatar AS shop_avatar, u.is_verified AS shop_verified, u.shop_status,
  r.avg_rating, COALESCE(r.review_count, 0) AS review_count`;

// Notes agregees par produit (avis clients verifies)
const RATING_JOIN = `
  LEFT JOIN (
    SELECT product_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
    FROM product_reviews
    GROUP BY product_id
  ) r ON r.product_id = p.id`;

const PRODUCT_FROM = `
  FROM products p
  JOIN users u ON u.id = p.merchant_id AND u.role = 'merchant' AND u.shop_slug IS NOT NULL
  ${RATING_JOIN}`;

const SORTS = Object.freeze({
  recent: 'p.created_at DESC, p.id DESC',
  newest: 'p.created_at DESC, p.id DESC',
  price_asc: 'p.price ASC, p.id ASC',
  price_desc: 'p.price DESC, p.id DESC',
  name: 'p.name ASC, p.id ASC',
  top_rated: 'COALESCE(r.avg_rating, 0) DESC, COALESCE(r.review_count, 0) DESC, p.created_at DESC, p.id DESC'
});

export const PRODUCT_SORTS = Object.freeze(Object.keys(SORTS));

// Echappe les jokers de LIKE (% et _) saisis par le visiteur ; caractere d'echappement : '!'
const likePattern = (value) => `%${value.replace(/[!%_]/g, '!$&')}%`;

const buildProductFilters = ({ q, category, shop, merchantId = null, minPrice, maxPrice, inStock }) => {
  const where = [];
  const params = [];

  if (q) {
    where.push("(p.name LIKE ? ESCAPE '!' OR p.description LIKE ? ESCAPE '!' OR p.category LIKE ? ESCAPE '!' OR COALESCE(NULLIF(u.shop_name, ''), u.name) LIKE ? ESCAPE '!')");
    const pattern = likePattern(q);
    params.push(pattern, pattern, pattern, pattern);
  }
  if (category) { where.push('p.category = ?'); params.push(category); }
  if (shop) { where.push('u.shop_slug = ?'); params.push(shop); }
  if (merchantId) { where.push('p.merchant_id = ?'); params.push(merchantId); }
  if (minPrice !== null) { where.push('p.price >= ?'); params.push(minPrice); }
  if (maxPrice !== null) { where.push('p.price <= ?'); params.push(maxPrice); }
  if (inStock) where.push('p.stock > 0');

  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
};

const SHOP_SELECT = `
  SELECT COALESCE(NULLIF(u.shop_name, ''), u.name) AS name, u.shop_slug, u.avatar, u.is_verified,
    COUNT(p.id) AS product_count,
    COALESCE(SUM(p.stock > 0), 0) AS in_stock_count,
    MIN(p.price) AS min_price
  FROM users u
  JOIN products p ON p.merchant_id = u.id
  WHERE u.role = 'merchant' AND u.shop_slug IS NOT NULL`;

export const MarketplaceModel = {
  async listProducts({ filters, sort, page, limit }) {
    const { sql, params } = buildProductFilters(filters);
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total ${PRODUCT_FROM} ${sql}`, params);
    const [rows] = await pool.query(
      `SELECT ${PRODUCT_COLUMNS} ${PRODUCT_FROM} ${sql} ORDER BY ${SORTS[sort]} LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit]
    );
    return { rows, total: Number(total) };
  },

  async findProductById(productId) {
    const [rows] = await pool.query(`SELECT ${PRODUCT_COLUMNS} ${PRODUCT_FROM} WHERE p.id = ? LIMIT 1`, [productId]);
    return rows[0] || null;
  },

  async listRelatedProducts(shopSlug, excludedProductId, limit = 4) {
    const [rows] = await pool.query(
      `SELECT ${PRODUCT_COLUMNS} ${PRODUCT_FROM}
      WHERE u.shop_slug = ? AND p.id <> ?
      ORDER BY (p.stock > 0) DESC, p.created_at DESC, p.id DESC
      LIMIT ?`,
      [shopSlug, excludedProductId, limit]
    );
    return rows;
  },

  async listShops({ q, page, limit }) {
    const nameFilter = q ? "AND COALESCE(NULLIF(u.shop_name, ''), u.name) LIKE ? ESCAPE '!'" : '';
    const params = q ? [likePattern(q)] : [];
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM (${SHOP_SELECT} ${nameFilter} GROUP BY u.id) AS shops`,
      params
    );
    const [rows] = await pool.query(
      `${SHOP_SELECT} ${nameFilter}
      GROUP BY u.id
      ORDER BY in_stock_count DESC, product_count DESC, name ASC
      LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit]
    );
    return { rows, total: Number(total) };
  },

  async listCategories() {
    const [rows] = await pool.query(
      `SELECT p.category AS name, COUNT(*) AS product_count ${PRODUCT_FROM}
      WHERE p.category IS NOT NULL AND p.category <> ''
      GROUP BY p.category
      ORDER BY product_count DESC, p.category ASC`
    );
    return rows;
  },

  async getStats() {
    const [[stats]] = await pool.query(
      `SELECT
        (SELECT COUNT(DISTINCT p.merchant_id) ${PRODUCT_FROM}) AS shop_count,
        (SELECT COUNT(*) ${PRODUCT_FROM} WHERE p.stock > 0) AS products_in_stock,
        (SELECT COUNT(*) FROM orders WHERE status = 'delivered') AS deliveries_completed`
    );
    return stats;
  },

  // ---------- Marketplace pro : produits similaires, suggestions, vitrine, avis ----------

  // Meme categorie (sinon meme boutique), produit courant exclu ; en stock et mieux notes d'abord
  async listSimilarProducts(product, limit = 4) {
    const sameCategory = Boolean(product.category);
    const [rows] = await pool.query(
      `SELECT ${PRODUCT_COLUMNS} ${PRODUCT_FROM}
      WHERE ${sameCategory ? 'p.category = ?' : 'u.shop_slug = ?'} AND p.id <> ?
      ORDER BY (p.stock > 0) DESC, COALESCE(r.avg_rating, 0) DESC, p.created_at DESC, p.id DESC
      LIMIT ?`,
      [sameCategory ? product.category : product.shop_slug, product.id, limit]
    );
    return rows;
  },

  async countShopProducts(merchantId) {
    const [[row]] = await pool.query('SELECT COUNT(*) AS total FROM products WHERE merchant_id = ?', [merchantId]);
    return Number(row.total);
  },

  // Autocompletion : 5 produits (ceux qui commencent par la saisie d'abord) et 3 categories
  async suggest(q) {
    const pattern = likePattern(q);
    const prefix = `${q.replace(/[!%_]/g, '!$&')}%`;
    const [products] = await pool.query(
      `SELECT p.id, p.name, p.price, p.image_url, p.category, COALESCE(NULLIF(u.shop_name, ''), u.name) AS shop_name, u.shop_slug ${PRODUCT_FROM}
      WHERE p.name LIKE ? ESCAPE '!'
      ORDER BY (p.name LIKE ? ESCAPE '!') DESC, (p.stock > 0) DESC, p.name ASC
      LIMIT 5`,
      [pattern, prefix]
    );
    const [categories] = await pool.query(
      `SELECT p.category AS name, COUNT(*) AS product_count ${PRODUCT_FROM}
      WHERE p.category LIKE ? ESCAPE '!'
      GROUP BY p.category
      ORDER BY product_count DESC, p.category ASC
      LIMIT 3`,
      [pattern]
    );
    return { products, categories };
  },

  // Vitrine publique : aucune donnee de contact (ni telephone, ni email)
  async findShopProfile(slug) {
    const [rows] = await pool.query(
      `SELECT u.id, COALESCE(NULLIF(u.shop_name, ''), u.name) AS name, u.shop_slug, u.avatar, u.shop_description, u.is_verified, u.shop_status, u.created_at,
        (SELECT COUNT(*) FROM products p WHERE p.merchant_id = u.id) AS product_count,
        (SELECT COUNT(*) FROM products p WHERE p.merchant_id = u.id AND p.stock > 0) AS in_stock_count,
        (SELECT AVG(pr.rating) FROM product_reviews pr JOIN products p ON p.id = pr.product_id WHERE p.merchant_id = u.id) AS avg_rating,
        (SELECT COUNT(*) FROM product_reviews pr JOIN products p ON p.id = pr.product_id WHERE p.merchant_id = u.id) AS review_count,
        (SELECT COUNT(*) FROM orders o WHERE o.merchant_id = u.id AND o.status = 'delivered') AS deliveries_completed
      FROM users u
      WHERE u.role = 'merchant' AND u.shop_slug = ?
      LIMIT 1`,
      [slug]
    );
    return rows[0] || null;
  },

  // Avis publics d'un produit (le telephone n'est jamais selectionne)
  async listReviews(productId, limit = 20) {
    const [rows] = await pool.query(
      `SELECT id, customer_name, rating, comment, is_verified_purchase, created_at
      FROM product_reviews
      WHERE product_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?`,
      [productId, limit]
    );
    return rows;
  },

  async ratingBreakdown(productId) {
    const [rows] = await pool.query(
      'SELECT rating, COUNT(*) AS total FROM product_reviews WHERE product_id = ? GROUP BY rating',
      [productId]
    );
    return rows;
  },

  /**
   * Commande LIVREE contenant le produit, retrouvee par code de suivi ou par telephone (9 derniers chiffres).
   * Une commande deja notee pour ce produit passe en dernier (le doublon sera refuse a l'insertion).
   */
  async findDeliveredOrderForReview({ productId, trackingCode = null, phoneDigits = null }) {
    const proof = trackingCode
      ? { sql: 'o.tracking_code = ?', value: trackingCode }
      : { sql: "RIGHT(REGEXP_REPLACE(o.client_phone, '[^0-9]', ''), 9) = ?", value: phoneDigits };
    const [rows] = await pool.query(
      `SELECT o.id
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id AND oi.product_id = ?
      WHERE o.status = 'delivered'
        AND (o.payment_method IS NULL OR o.payment_status = 'paid')
        AND ${proof.sql}
      ORDER BY EXISTS (SELECT 1 FROM product_reviews pr WHERE pr.order_id = o.id AND pr.product_id = ?) ASC, o.id DESC
      LIMIT 1`,
      [productId, proof.value, productId]
    );
    return rows[0] || null;
  },

  async insertReview({ productId, orderId, customerName, customerPhone, rating, comment }) {
    const [result] = await pool.query(
      `INSERT INTO product_reviews (product_id, order_id, customer_name, customer_phone, rating, comment, is_verified_purchase)
      VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [productId, orderId, customerName, customerPhone, rating, comment]
    );
    const [[row]] = await pool.query(
      'SELECT id, customer_name, rating, comment, is_verified_purchase, created_at FROM product_reviews WHERE id = ?',
      [result.insertId]
    );
    return row;
  },

  // Suivi public : uniquement statut, dates et nom de la boutique.
  // Ni identifiant interne, ni client, ni adresse, ni coordonnees, ni livreur.
  async findTrackingByCode(trackingCode) {
    const [rows] = await pool.query(
      `SELECT o.id, o.tracking_code, o.status, o.payment_method, o.payment_status, o.created_at, o.updated_at,
        COALESCE(NULLIF(u.shop_name, ''), u.name) AS shop_name, u.shop_slug
      FROM orders o
      JOIN users u ON u.id = o.merchant_id
      WHERE o.tracking_code = ?
      LIMIT 1`,
      [trackingCode]
    );
    const order = rows[0];

    if (!order) {
      return null;
    }

    const [history] = await pool.query(
      'SELECT status, `timestamp` AS at FROM delivery_logs WHERE order_id = ? ORDER BY `timestamp` ASC, id ASC',
      [order.id]
    );
    return { order, history };
  }
};
