import express from 'express';
import { getAvailableDrivers, updateCurrentLocation } from '../controllers/driverController.js';
import { authorizeRoles, protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.put('/location', protect, authorizeRoles('driver'), updateCurrentLocation);
router.get('/available', protect, authorizeRoles('admin'), getAvailableDrivers);

export default router;
