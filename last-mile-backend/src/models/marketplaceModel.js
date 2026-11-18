import pool from '../config/db.js';

// Requetes de la marketplace publique.
// REGLE : aucune donnee de contact (telephone, email) des marchands, aucune donnee client ni livreur.
// Seules les boutiques actives (marchand avec un shop_slug) sont visibles.

const PRODUCT_COLUMNS = `
  p.id, p.name, p.description, p.category, p.price, p.image_url, p.stock, p.created_at,
  u.name AS shop_name, u.shop_slug, u.avatar AS shop_avatar`;

const PRODUCT_FROM = `
  FROM products p
  JOIN users u ON u.id = p.merchant_id AND u.role = 'merchant' AND u.shop_slug IS NOT NULL`;

const SORTS = Object.freeze({
  recent: 'p.created_at DESC, p.id DESC',
  price_asc: 'p.price ASC, p.id ASC',
  price_desc: 'p.price DESC, p.id DESC',
  name: 'p.name ASC, p.id ASC'
});

export const PRODUCT_SORTS = Object.freeze(Object.keys(SORTS));

// Echappe les jokers de LIKE (% et _) saisis par le visiteur ; caractere d'echappement : '!'
const likePattern = (value) => `%${value.replace(/[!%_]/g, '!$&')}%`;

const buildProductFilters = ({ q, category, shop, minPrice, maxPrice, inStock }) => {
  const where = [];
  const params = [];

  if (q) {
    where.push("(p.name LIKE ? ESCAPE '!' OR p.description LIKE ? ESCAPE '!' OR p.category LIKE ? ESCAPE '!' OR u.name LIKE ? ESCAPE '!')");
    const pattern = likePattern(q);
    params.push(pattern, pattern, pattern, pattern);
  }
  if (category) { where.push('p.category = ?'); params.push(category); }
  if (shop) { where.push('u.shop_slug = ?'); params.push(shop); }
  if (minPrice !== null) { where.push('p.price >= ?'); params.push(minPrice); }
  if (maxPrice !== null) { where.push('p.price <= ?'); params.push(maxPrice); }
  if (inStock) where.push('p.stock > 0');

  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
};

const SHOP_SELECT = `
  SELECT u.name, u.shop_slug, u.avatar,
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
    const nameFilter = q ? "AND u.name LIKE ? ESCAPE '!'" : '';
    const params = q ? [likePattern(q)] : [];
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM (${SHOP_SELECT} ${nameFilter} GROUP BY u.id) AS shops`,
      params
    );
    const [rows] = await pool.query(
      `${SHOP_SELECT} ${nameFilter}
      GROUP BY u.id
      ORDER BY in_stock_count DESC, product_count DESC, u.name ASC
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

  // Suivi public : uniquement statut, dates et nom de la boutique.
  // Ni identifiant interne, ni client, ni adresse, ni coordonnees, ni livreur.
  async findTrackingByCode(trackingCode) {
    const [rows] = await pool.query(
      `SELECT o.id, o.tracking_code, o.status, o.payment_method, o.payment_status, o.created_at, o.updated_at,
        u.name AS shop_name, u.shop_slug
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
