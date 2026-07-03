// FILE: src/models/userModel.js
import pool from '../config/db.js';

const createShopSlug = (name, userId) => {
  const normalizedName = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90) || 'merchant';

  return `${normalizedName}-${userId}`;
};

const UserModel = {
  async findByEmail(email) {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] || null;
  },

  async findById(userId) {
    const [rows] = await pool.query(
      'SELECT id, name, email, phone, role, avatar, shop_slug FROM users WHERE id = ?',
      [userId]
    );
    return rows[0] || null;
  },

  async create(name, email, hashedPassword, phone, role) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const [result] = await connection.query(
        'INSERT INTO users (name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)',
        [name, email, hashedPassword, phone, role]
      );

      if (role === 'merchant') {
        await connection.query(
          'UPDATE users SET shop_slug = ? WHERE id = ?',
          [createShopSlug(name, result.insertId), result.insertId]
        );
      }

      await connection.commit();
      return result.insertId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async updateAvatar(userId, avatar) {
    const [result] = await pool.query(
      'UPDATE users SET avatar = ? WHERE id = ?',
      [avatar, userId]
    );
    return result.affectedRows;
  },

  async updateProfile(userId, name, phone) {
    const [result] = await pool.query(
      'UPDATE users SET name = ?, phone = ? WHERE id = ?',
      [name, phone, userId]
    );
    return result.affectedRows;
  },

  async findDriversByIds(driverIds) {
    if (!driverIds.length) {
      return [];
    }

    const placeholders = driverIds.map(() => '?').join(', ');
    const [rows] = await pool.query(
      `SELECT id, name, phone, avatar FROM users WHERE role = 'driver' AND id IN (${placeholders}) ORDER BY name ASC`,
      driverIds
    );
    return rows;
  },

  async findDetailsById(userId) {
    const [rows] = await pool.query(
      `SELECT
        u.id,
        u.name,
        u.email,
        u.phone,
        u.role,
        u.avatar,
        u.created_at,
        (SELECT COUNT(*) FROM orders o WHERE o.merchant_id = u.id) AS orders_created,
        (SELECT COUNT(*) FROM orders o WHERE o.driver_id = u.id) AS deliveries_assigned,
        (SELECT COUNT(*) FROM orders o WHERE o.driver_id = u.id AND o.status = 'delivered') AS deliveries_completed
      FROM users u
      WHERE u.id = ?`,
      [userId]
    );
    return rows[0] || null;
  }
};

export default UserModel;
