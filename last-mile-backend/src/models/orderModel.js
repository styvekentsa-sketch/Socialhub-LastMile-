// FILE: src/models/orderModel.js
import pool from '../config/db.js';

export const OrderModel = {
  async create(merchantId, clientName, clientPhone, deliveryAddress, latitude, longitude, description = null) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [result] = await connection.query(
        'INSERT INTO orders (merchant_id, client_name, client_phone, delivery_address, latitude, longitude, description, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [merchantId, clientName, clientPhone, deliveryAddress, latitude, longitude, description, 'pending']
      );

      await connection.query(
        'INSERT INTO delivery_logs (order_id, status, changed_by) VALUES (?, ?, ?)',
        [result.insertId, 'pending', merchantId]
      );

      await connection.commit();
      return result.insertId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async assignDriver(orderId, driverId, changedBy) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [result] = await connection.query(
        'UPDATE orders SET driver_id = ?, status = ? WHERE id = ?',
        [driverId, 'assigned', orderId]
      );

      if (result.affectedRows > 0) {
        await connection.query(
          'INSERT INTO delivery_logs (order_id, status, changed_by) VALUES (?, ?, ?)',
          [orderId, 'assigned', changedBy]
        );
      }

      await connection.commit();
      return result.affectedRows;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async updateStatus(orderId, status) {
    const [result] = await pool.query(
      'UPDATE orders SET status = ? WHERE id = ?',
      [status, orderId]
    );

    return result.affectedRows;
  },

  async findById(orderId) {
    const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    return rows[0] || null;
  },

  async findTrackingStateById(orderId) {
    const [rows] = await pool.query(
      `SELECT
        o.*,
        driver.name AS driver_name,
        driver.phone AS driver_phone,
        driver.avatar AS driver_avatar,
        p.latitude AS driver_latitude,
        p.longitude AS driver_longitude,
        p.accuracy AS driver_position_accuracy,
        p.heading AS driver_position_heading,
        p.speed AS driver_position_speed,
        p.captured_at AS driver_position_captured_at,
        p.updated_at AS driver_position_updated_at
      FROM orders o
      LEFT JOIN users driver ON driver.id = o.driver_id
      LEFT JOIN driver_positions p ON p.driver_id = o.driver_id
      WHERE o.id = ?`,
      [orderId]
    );
    return rows[0] || null;
  },

  async getActiveOrdersByDriver(driverId) {
    const [rows] = await pool.query(
      `SELECT id, merchant_id, driver_id, status
      FROM orders
      WHERE driver_id = ?
        AND status NOT IN ('delivered', 'failed', 'cancelled')`,
      [driverId]
    );
    return rows;
  },

  async findDriverById(driverId) {
    const [rows] = await pool.query(
      'SELECT id FROM users WHERE id = ? AND role = ?',
      [driverId, 'driver']
    );
    return rows[0] || null;
  },

  async getOrdersByRole(role, userId) {
    let query = `SELECT
      o.*,
      merchant.name AS merchant_name,
      merchant.email AS merchant_email,
      merchant.phone AS merchant_phone,
      merchant.avatar AS merchant_avatar,
      driver.name AS driver_name,
      driver.email AS driver_email,
      driver.phone AS driver_phone,
      driver.avatar AS driver_avatar
    FROM orders o
    JOIN users merchant ON merchant.id = o.merchant_id
    LEFT JOIN users driver ON driver.id = o.driver_id`;
    const params = [];

    const paidCheckoutFilter = "(o.payment_method IS NULL OR o.payment_status = 'paid')";

    if (role === 'merchant') {
      query += ` WHERE o.merchant_id = ? AND ${paidCheckoutFilter}`;
      params.push(userId);
    } else if (role === 'driver') {
      query += ` WHERE o.driver_id = ? AND ${paidCheckoutFilter}`;
      params.push(userId);
    } else if (role === 'admin') {
      query += ` WHERE ${paidCheckoutFilter}`;
    } else {
      return [];
    }

    query += ' ORDER BY o.created_at DESC';

    const [rows] = await pool.query(query, params);
    return rows;
  }
};
