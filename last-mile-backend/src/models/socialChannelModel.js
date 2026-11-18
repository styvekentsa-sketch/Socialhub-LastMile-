import pool from '../config/db.js';

// Canaux sociaux des marchands et historique des publications.
// ISOLATION : toutes les requetes portent sur un merchant_id explicite ; un marchand ne peut ni lire,
// ni modifier, ni utiliser les canaux d'un autre (WHERE id = ? AND merchant_id = ?).
const CHANNEL_COLUMNS = 'id, merchant_id, platform, channel_name, credentials_json, auto_publish, is_active, created_at, updated_at';

export const MAX_CHANNELS_PER_MERCHANT = 20;

export const SocialChannelModel = {
  async listByMerchant(merchantId) {
    const [rows] = await pool.query(
      `SELECT ${CHANNEL_COLUMNS} FROM merchant_social_channels WHERE merchant_id = ? ORDER BY created_at ASC, id ASC`,
      [merchantId]
    );
    return rows;
  },

  async countByMerchant(merchantId) {
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM merchant_social_channels WHERE merchant_id = ?', [merchantId]);
    return Number(total);
  },

  async findOwned(channelId, merchantId) {
    const [rows] = await pool.query(
      `SELECT ${CHANNEL_COLUMNS} FROM merchant_social_channels WHERE id = ? AND merchant_id = ? LIMIT 1`,
      [channelId, merchantId]
    );
    return rows[0] || null;
  },

  async listPublishable(merchantId, { autoOnly }) {
    const [rows] = await pool.query(
      `SELECT ${CHANNEL_COLUMNS} FROM merchant_social_channels
      WHERE merchant_id = ? AND is_active = 1 ${autoOnly ? 'AND auto_publish = 1' : ''}
      ORDER BY id ASC`,
      [merchantId]
    );
    return rows;
  },

  async create(merchantId, { platform, channelName, credentialsJson, autoPublish, isActive }) {
    const [result] = await pool.query(
      `INSERT INTO merchant_social_channels (merchant_id, platform, channel_name, credentials_json, auto_publish, is_active)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [merchantId, platform, channelName, credentialsJson, autoPublish ? 1 : 0, isActive ? 1 : 0]
    );
    return this.findOwned(result.insertId, merchantId);
  },

  async update(channelId, merchantId, { channelName, credentialsJson, autoPublish, isActive }) {
    await pool.query(
      `UPDATE merchant_social_channels
      SET channel_name = ?, credentials_json = ?, auto_publish = ?, is_active = ?
      WHERE id = ? AND merchant_id = ?`,
      [channelName, credentialsJson, autoPublish ? 1 : 0, isActive ? 1 : 0, channelId, merchantId]
    );
    return this.findOwned(channelId, merchantId);
  },

  async remove(channelId, merchantId) {
    const [result] = await pool.query('DELETE FROM merchant_social_channels WHERE id = ? AND merchant_id = ?', [channelId, merchantId]);
    return result.affectedRows === 1;
  },

  // Produit du marchand (et de lui seul) a publier
  async findMerchantProduct(productId, merchantId) {
    const [rows] = await pool.query(
      'SELECT id, merchant_id, name, description, price, image_url, stock FROM products WHERE id = ? AND merchant_id = ? LIMIT 1',
      [productId, merchantId]
    );
    return rows[0] || null;
  },

  async recordPost({ productId, merchantId, channelId, platform, status, externalPostId, errorMessage }) {
    await pool.query(
      `INSERT INTO product_social_posts (product_id, merchant_id, channel_id, platform, status, external_post_id, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [productId, merchantId, channelId, platform, status, externalPostId ? String(externalPostId).slice(0, 191) : null, errorMessage ? String(errorMessage).slice(0, 500) : null]
    );
  }
};
