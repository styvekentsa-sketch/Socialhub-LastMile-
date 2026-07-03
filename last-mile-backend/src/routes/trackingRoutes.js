// FILE: src/routes/trackingRoutes.js
import express from 'express';
import pool from '../config/db.js';
import { updateOrderStatus } from '../controllers/trackingController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const parsePositiveInteger = (value) => {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
};

router.get('/:orderId', protect, async (req, res, next) => {
  try {
    const orderId = parsePositiveInteger(req.params.orderId);

    if (!orderId) {
      throw createHttpError('Identifiant de commande invalide.', 400);
    }

    const [logs] = await pool.query(
      `SELECT
        l.id,
        l.order_id,
        l.status,
        l.timestamp,
        u.id AS operator_id,
        u.name AS operator_name
      FROM delivery_logs l
      JOIN users u ON l.changed_by = u.id
      WHERE l.order_id = ?
      ORDER BY l.timestamp DESC`,
      [orderId]
    );

    return res.status(200).json(logs);
  } catch (error) {
    if (error.statusCode) {
      res.status(error.statusCode);
    }

    return next(error);
  }
});

router.put(
  '/:orderId/status',
  protect,
  authorizeRoles('admin', 'driver'),
  updateOrderStatus
);

export default router;
