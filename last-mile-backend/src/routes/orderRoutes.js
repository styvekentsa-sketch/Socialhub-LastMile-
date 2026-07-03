// FILE: src/routes/orderRoutes.js
import express from 'express';
import {
  assignDriver,
  createOrder,
  getOrderDetails,
  getOrderTrackingState,
  getUserOrders
} from '../controllers/orderController.js';
import { getOrderHistory, updateOrderStatus } from '../controllers/trackingController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/', protect, authorizeRoles('merchant'), createOrder);

router.get('/', protect, getUserOrders);

router.get('/:orderId/tracking', protect, getOrderHistory);
router.get('/:id/tracking-state', protect, getOrderTrackingState);

router.patch('/:id/assign', protect, authorizeRoles('admin'), assignDriver);
router.put('/:id/assign', protect, authorizeRoles('admin'), assignDriver);
router.put('/:orderId/status', protect, authorizeRoles('admin', 'driver'), updateOrderStatus);
router.get('/:id', protect, getOrderDetails);

export default router;
