import express from 'express';
import {
  deleteChannel,
  listChannels,
  publishProductNow,
  saveChannel
} from '../controllers/merchantSocialController.js';
import { authorizeRoles, protect } from '../middlewares/authMiddleware.js';
import { socialPublishRateLimiter } from '../middlewares/rateLimiter.js';

// Social commerce : canaux de publication propres au marchand connecte
const router = express.Router();

router.use(protect, authorizeRoles('merchant'));
router.get('/channels', listChannels);
router.post('/channels', saveChannel);
router.delete('/channels/:id', deleteChannel);
router.post('/products/:id/publish', socialPublishRateLimiter, publishProductNow);

export default router;
