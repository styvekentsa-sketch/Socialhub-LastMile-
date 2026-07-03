// FILE: src/routes/adminRoutes.js
import express from 'express';
import { unblockDriver } from '../controllers/trackingController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post(
  '/drivers/:driverId/unblock',
  protect,
  authorizeRoles('admin'),
  unblockDriver
);

export default router;
