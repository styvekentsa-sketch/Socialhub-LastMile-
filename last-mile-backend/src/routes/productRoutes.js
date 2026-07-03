import express from 'express';
import {
  createProduct,
  deleteProduct,
  getMerchantProducts,
  updateProductStock
} from '../controllers/productController.js';
import { authorizeRoles, protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(protect, authorizeRoles('merchant'));
router.get('/', getMerchantProducts);
router.post('/', createProduct);
router.patch('/:id/stock', updateProductStock);
router.delete('/:id', deleteProduct);

export default router;
