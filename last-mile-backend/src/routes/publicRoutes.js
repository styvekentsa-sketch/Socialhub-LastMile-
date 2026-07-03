import express from 'express';
import { checkout, getPublicPayment, getPublicShop } from '../controllers/publicController.js';

const router = express.Router();

router.get('/shops/:slug', getPublicShop);
router.get('/payments/:reference', getPublicPayment);
router.post('/checkout', checkout);

export default router;
