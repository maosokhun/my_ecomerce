import { Router } from 'express';
import {
  createOrder,
  previewCoupon,
  getUserOrders,
  getOrder,
  getOrderInvoice,
  cancelOrder,
  confirmPayment,
  createStripePaymentIntentForOrder,
  archiveOrderHistory,
  adminGetOrders,
  adminUpdateOrderStatus,
} from '../controllers/order.controller';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.post('/', createOrder);
router.post('/coupon-preview', previewCoupon);
router.get('/', getUserOrders);

// Static routes must come BEFORE /:id wildcard routes
router.post('/confirm-payment', confirmPayment);
router.post('/stripe-payment-intent', createStripePaymentIntentForOrder);

// Admin routes
router.get('/admin/all', requireAdmin, adminGetOrders);
router.put('/admin/:id/status', requireAdmin, adminUpdateOrderStatus);

// Wildcard /:id routes
router.get('/:id', getOrder);
router.get('/:id/invoice', getOrderInvoice);
router.delete('/:id/history', archiveOrderHistory);
router.put('/:id/cancel', cancelOrder);

export default router;
