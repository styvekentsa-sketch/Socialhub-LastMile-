import express from 'express';
import { handleFlutterwaveWebhook } from '../controllers/paymentController.js';

const router = express.Router();

router.post('/webhook', handleFlutterwaveWebhook);

export default router;
