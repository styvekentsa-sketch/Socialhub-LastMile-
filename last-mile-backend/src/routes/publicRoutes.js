import express from 'express';
import {
  getMarketplaceHome,
  getProduct,
  listProducts,
  listShops,
  trackParcel
} from '../controllers/marketplaceController.js';
import { checkout, getPublicPayment, getPublicShop } from '../controllers/publicController.js';
import { productSearchRateLimiter, trackingRateLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

// Boutique et paiement (existant)
router.get('/shops/:slug', getPublicShop);
router.get('/payments/:reference', getPublicPayment);
router.post('/checkout', checkout);

// Marketplace publique (sans connexion, sans donnees de contact des marchands)
router.get('/marketplace', getMarketplaceHome);
router.get('/products', productSearchRateLimiter, listProducts);
router.get('/products/:id', getProduct);
router.get('/shops', listShops);
router.get('/tracking/:code', trackingRateLimiter, trackParcel);

export default router;
