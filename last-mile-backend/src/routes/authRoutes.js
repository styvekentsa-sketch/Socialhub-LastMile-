// FILE: src/routes/authRoutes.js
import express from 'express';
import { getCurrentUser, login, register } from '../controllers/authController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getCurrentUser);

export default router;
