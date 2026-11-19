import express from 'express';
import {
  createReview,
  getProductDetails,
  getShopShowcase,
  getSuggestions,
  listProducts
} from '../controllers/marketplaceProController.js';
import { productSearchRateLimiter, reviewRateLimiter, suggestionRateLimiter } from '../middlewares/rateLimiter.js';

// Marketplace publique « pro » (sans connexion). Les routes /api/public existantes restent inchangees.
const router = express.Router();

router.get('/products', productSearchRateLimiter, listProducts);
router.get('/suggestions', suggestionRateLimiter, getSuggestions);
router.get('/products/:id', getProductDetails);
router.post('/products/:id/reviews', reviewRateLimiter, createReview);
router.get('/shops/:slug', getShopShowcase);

export default router;
