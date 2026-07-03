import express from 'express';
import { getUserDetails, updateAvatar, updateProfile } from '../controllers/userController.js';
import { authorizeRoles, protect } from '../middlewares/authMiddleware.js';
import { uploadAvatar } from '../config/avatarUpload.js';

const router = express.Router();

router.put('/profile/avatar', protect, uploadAvatar, updateAvatar);
router.put('/profile', protect, updateProfile);
router.get('/:id', protect, authorizeRoles('admin'), getUserDetails);

export default router;
