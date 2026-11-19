import express from 'express';
import {
  getSettings,
  revokeOtherSessions,
  updateNotificationSettings,
  updatePassword,
  updateSettingsProfile
} from '../controllers/settingsController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { passwordChangeRateLimiter } from '../middlewares/rateLimiter.js';

// Parametres du compte connecte (tous roles : marchand, livreur, administrateur)
const router = express.Router();

router.use(protect);
router.get('/profile', getSettings);
router.put('/profile', updateSettingsProfile);
router.put('/password', passwordChangeRateLimiter, updatePassword);
router.post('/sessions/revoke-others', revokeOtherSessions);
router.put('/notifications', updateNotificationSettings);

export default router;
