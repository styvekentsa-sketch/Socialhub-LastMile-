import pool from '../config/db.js';

const SETTINGS_COLUMNS = `
  id, name, email, phone, role, avatar, created_at, last_login_at, previous_login_at,
  notification_prefs, ui_language,
  shop_slug, shop_name, shop_description, pickup_address, default_city, shop_status, is_verified`;

const SettingsModel = {
  async findById(userId) {
    const [rows] = await pool.query(`SELECT ${SETTINGS_COLUMNS} FROM users WHERE id = ?`, [userId]);
    return rows[0] || null;
  },

  async findPasswordHash(userId) {
    const [rows] = await pool.query('SELECT password FROM users WHERE id = ?', [userId]);
    return rows[0]?.password || null;
  },

  async isEmailTaken(email, exceptUserId) {
    const [rows] = await pool.query('SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1', [email, exceptUserId]);
    return rows.length > 0;
  },

  async isSlugTaken(slug, exceptUserId) {
    const [rows] = await pool.query('SELECT id FROM users WHERE shop_slug = ? AND id <> ? LIMIT 1', [slug, exceptUserId]);
    return rows.length > 0;
  },

  /** Profil + boutique dans une seule transaction (tout ou rien). */
  async updateProfile(userId, profile, shop) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?', [profile.name, profile.email, profile.phone, userId]);
      if (shop) {
        await connection.query(
          `UPDATE users SET shop_name = ?, shop_slug = ?, shop_description = ?, pickup_address = ?, default_city = ?, shop_status = ?
          WHERE id = ? AND role = 'merchant'`,
          [shop.name, shop.slug, shop.description, shop.pickup_address, shop.default_city, shop.status, userId]
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async updatePassword(userId, hashedPassword) {
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
  },

  async updatePreferences(userId, notificationPrefs, language) {
    await pool.query('UPDATE users SET notification_prefs = ?, ui_language = ? WHERE id = ?', [JSON.stringify(notificationPrefs), language, userId]);
  }
};

export default SettingsModel;
