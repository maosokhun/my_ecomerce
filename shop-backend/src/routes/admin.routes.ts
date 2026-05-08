import { Router } from 'express';
import {
  getDashboardStats,
  getUsers,
  updateUser,
  deleteUser,
  createCoupon,
  getCoupons,
  updateCoupon,
  deleteCoupon,
  getAdvertisements,
  getSellerProfiles,
  getUnreadCounts,
  markSeen,
} from '../controllers/admin.controller';
import { getAdminProducts } from '../controllers/product.controller';
import { getAdminCategories } from '../controllers/category.controller';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/dashboard', getDashboardStats);
router.get('/products', getAdminProducts);
router.get('/categories', getAdminCategories);
router.get('/users', getUsers);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.get('/coupons', getCoupons);
router.post('/coupons', createCoupon);
router.put('/coupons/:id', updateCoupon);
router.delete('/coupons/:id', deleteCoupon);
router.get('/ads', getAdvertisements);
router.get('/sellers', getSellerProfiles);
router.get('/unread-counts', getUnreadCounts);
router.post('/mark-seen', markSeen);

export default router;
