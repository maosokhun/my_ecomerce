import { Request, Response } from 'express';
import Stripe from 'stripe';
import prisma from '../lib/prisma';
import stripe from '../lib/stripe';
import { assertPaymentIntentMatchesOrder, persistOrderPaidFromStripe } from '../lib/stripeOrderPayment';

export const handleStripeWebhook = async (req: Request, res: Response): Promise<void> => {
  if (!stripe) {
    res.status(503).json({ success: false, message: 'Stripe is not configured' });
    return;
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    res.status(503).json({ success: false, message: 'STRIPE_WEBHOOK_SECRET is not set' });
    return;
  }

  const sig = req.headers['stripe-signature'];
  if (!sig || typeof sig !== 'string') {
    res.status(400).send('Missing stripe-signature header');
    return;
  }

  const rawBody = req.body;
  if (!Buffer.isBuffer(rawBody)) {
    res.status(400).send('Invalid webhook body');
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Stripe webhook] Signature verification failed:', msg);
    res.status(400).send(`Webhook signature verification failed: ${msg}`);
    return;
  }

  try {
    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent;
      const orderId = pi.metadata?.orderId;
      if (!orderId) {
        res.json({ received: true, ignored: true });
        return;
      }

      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order) {
        res.json({ received: true, ignored: true });
        return;
      }

      if (order.paymentStatus === 'PAID') {
        res.json({ received: true });
        return;
      }

      try {
        assertPaymentIntentMatchesOrder(order, pi);
      } catch (e) {
        console.error('[Stripe webhook] PaymentIntent validation failed:', e);
        res.json({ received: true, ignored: true });
        return;
      }

      await persistOrderPaidFromStripe(order.id, pi.id);
    }

    res.json({ received: true });
  } catch (e) {
    console.error('[Stripe webhook] Handler error:', e);
    res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
};
