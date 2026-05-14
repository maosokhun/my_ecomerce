import type Stripe from 'stripe';
import type { Order } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import prisma from './prisma';
import { sendInvoiceNotification } from './invoice';
import { notifyAdminOrderEvent } from './adminNotifier';

export function assertPaymentIntentMatchesOrder(order: Order, pi: Stripe.PaymentIntent): void {
  if (pi.metadata?.orderId !== order.id) {
    throw new AppError('Payment does not match this order', 400);
  }
  const expectedCents = Math.round(Number(order.total) * 100);
  if (pi.amount !== expectedCents) {
    throw new AppError('Payment amount does not match order total', 400);
  }
  if (pi.status !== 'succeeded') {
    throw new AppError('Payment has not completed yet', 400);
  }
}

/** Marks order paid once; returns whether this call performed the update (for idempotency). */
export async function persistOrderPaidFromStripe(
  orderId: string,
  paymentIntentId: string
): Promise<boolean> {
  const result = await prisma.order.updateMany({
    where: { id: orderId, paymentStatus: { not: 'PAID' } },
    data: {
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      paymentIntentId,
    },
  });
  if (result.count === 0) return false;

  sendInvoiceNotification(orderId).catch((error) => {
    console.error('[Stripe] Invoice notification failed:', error);
  });
  notifyAdminOrderEvent(orderId, 'PAYMENT_PAID').catch((error) => {
    console.error('[Stripe] Admin payment notification failed:', error);
  });
  return true;
}
