// FILE: src/models/trackingModel.js
import pool from '../config/db.js';

export const TrackingModel = {
  async updatePosition(driverId, latitude, longitude) {
    await pool.query(
      'INSERT INTO driver_positions (driver_id, latitude, longitude) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE latitude = ?, longitude = ?, updated_at = CURRENT_TIMESTAMP',
      [driverId, latitude, longitude, latitude, longitude]
    );
  },

  async createLog(orderId, status, changedBy) {
    await pool.query(
      'INSERT INTO delivery_logs (order_id, status, changed_by) VALUES (?, ?, ?)',
      [orderId, status, changedBy]
    );
  },

  async updateOrderStatus(orderId, status, changedBy) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      await connection.query(
        'UPDATE orders SET status = ? WHERE id = ?',
        [status, orderId]
      );
      await connection.query(
        'INSERT INTO delivery_logs (order_id, status, changed_by) VALUES (?, ?, ?)',
        [orderId, status, changedBy]
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async getLogsByOrderId(orderId) {
    const [rows] = await pool.query(
      `SELECT
        l.id,
        l.order_id,
        l.status,
        l.changed_by,
        l.timestamp AS created_at,
        u.name AS operator_name
      FROM delivery_logs l
      JOIN users u ON l.changed_by = u.id
      WHERE l.order_id = ?
      ORDER BY created_at DESC`,
      [orderId]
    );

    return rows;
  }
};
