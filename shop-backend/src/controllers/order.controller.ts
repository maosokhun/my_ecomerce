import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { generateOrderNumber, paginate, paginateResponse } from '../utils/helpers';
import stripeClient from '../lib/stripe';
import { getInvoiceDetails, sendInvoiceNotification } from '../lib/invoice';
import { notifyAdminOrderEvent, notifyAdminOrderStatusChanged, notifyAdminUserCancelledOrder } from '../lib/adminNotifier';

export const createOrder = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { addressId, paymentMethod = 'card', notes, couponCode, shippingCarrier: rawCarrier } = req.body;
    const method = String(paymentMethod).toLowerCase();
    const allowedMethods = ['card', 'bakong'];
    if (!allowedMethods.includes(method)) {
      throw new AppError('Invalid payment method. Allowed: card, bakong', 400);
    }

    const cart = await prisma.cart.findUnique({
      where: { userId: req.user!.id },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new AppError('Cart is empty', 400);
    }

    // Validate stock for all items
    for (const item of cart.items) {
      if (!item.product.isActive) {
        throw new AppError(`Product "${item.product.name}" is no longer available`, 400);
      }
      if (item.product.stock < item.quantity) {
        throw new AppError(`Insufficient stock for "${item.product.name}"`, 400);
      }
    }

    const subtotal = cart.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    let discount = 0;
    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({
        where: { code: couponCode.toUpperCase(), isActive: true },
      });
      if (!coupon) throw new AppError('Invalid coupon code', 400);
      if (coupon.expiresAt && coupon.expiresAt < new Date()) {
        throw new AppError('Coupon has expired', 400);
      }
      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        throw new AppError('Coupon usage limit reached', 400);
      }
      if (coupon.minOrder && subtotal < coupon.minOrder) {
        throw new AppError(`Minimum order is ${coupon.minOrder} for this coupon`, 400);
      }
      if (coupon.discountType === 'PERCENTAGE') {
        discount = (subtotal * coupon.discount) / 100;
        if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
      } else {
        discount = coupon.discount;
      }
      discount = Math.max(0, Math.min(discount, subtotal));
      await prisma.coupon.update({
        where: { id: coupon.id },
        data: { usedCount: { increment: 1 } },
      });
    }

    const settings = await prisma.siteSettings.findUnique({ where: { id: 'default' } });
    const legacyFee = settings?.shippingFee ?? 1.0;
    const vetFee = settings?.shippingFeeVet ?? legacyFee;
    const jntFee = settings?.shippingFeeJnt ?? legacyFee;

    const carrierRaw = String(rawCarrier || 'VET').toUpperCase();
    const shippingCarrier = carrierRaw === 'JNT' ? 'JNT' : 'VET';
    const shippingCost = shippingCarrier === 'JNT' ? jntFee : vetFee;
    const tax = 0; // Removed tax per user request
    const total = subtotal + shippingCost + tax - discount;

    // Get address details
    let shippingAddress = null;
    if (addressId) {
      const address = await prisma.address.findFirst({
        where: { id: addressId, userId: req.user!.id },
      });
      if (address) {
        shippingAddress = {
          name: address.name,
          phone: address.phone,
          provinceId: address.provinceId,
          districtId: address.districtId,
          communeId: address.communeId,
          villageId: address.villageId,
          province: address.province,
          district: address.district,
          commune: address.commune,
          village: address.village,
          roadNumber: address.roadNumber,
          street: address.street,
          city: address.city,
          state: address.state,
          country: address.country,
          zipCode: address.zipCode,
          note: address.note,
        };
      }
    }

    const orderNumber = generateOrderNumber();

    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId: req.user!.id,
        addressId,
        subtotal,
        discount,
        shippingCost,
        tax,
        total,
        notes,
        shippingCarrier,
        shippingAddress: shippingAddress ?? undefined,
        paymentMethod: method,
        items: {
          create: cart.items.map((item) => ({
            productId: item.productId,
            name: item.product.name,
            image: item.product.thumbnail,
            price: item.product.price,
            quantity: item.quantity,
          })),
        },
      },
      include: { items: true, address: true },
    });

    // Deduct stock
    await Promise.all(
      cart.items.map((item) =>
        prisma.product.update({
          where: { id: item.productId },
          data: {
            stock: { decrement: item.quantity },
            soldCount: { increment: item.quantity },
          },
        })
      )
    );

    // Clear cart
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

    // Create Stripe payment intent (optional — skipped if Stripe key not configured)
    let clientSecret = null;
    if (method === 'card' && stripeClient) {
      try {
        const paymentIntent = await stripeClient.paymentIntents.create({
          amount: Math.round(total * 100),
          currency: 'usd',
          metadata: { orderId: order.id, orderNumber },
        });

        await prisma.order.update({
          where: { id: order.id },
          data: { paymentIntentId: paymentIntent.id },
        });

        clientSecret = paymentIntent.client_secret;
      } catch {
        // Stripe error — continue without payment intent
      }
    }

    // Generate and send invoice via email/SMS in background-safe way.
    sendInvoiceNotification(order.id).catch((error) => {
      console.error('[Invoice] Notification failed:', error);
    });
    notifyAdminOrderEvent(order.id, 'NEW_ORDER').catch((error) => {
      console.error('[Admin Notify] New order notification failed:', error);
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        order,
        clientSecret,
        paymentGuide:
          method === 'bakong'
            ? 'Use your Bakong app to complete payment to merchant KHQR/ID after order placement.'
            : undefined,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const previewCoupon = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { couponCode, shippingCarrier: rawCarrier } = req.body as {
      couponCode?: string;
      shippingCarrier?: string;
    };
    const cart = await prisma.cart.findUnique({
      where: { userId: req.user!.id },
      include: { items: { include: { product: true } } },
    });
    if (!cart || cart.items.length === 0) throw new AppError('Cart is empty', 400);

    const subtotal = cart.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const settings = await prisma.siteSettings.findUnique({ where: { id: 'default' } });
    const legacyFee = settings?.shippingFee ?? 1.0;
    const vetFee = settings?.shippingFeeVet ?? legacyFee;
    const jntFee = settings?.shippingFeeJnt ?? legacyFee;
    const carrierRaw = String(rawCarrier || 'VET').toUpperCase();
    const shippingCarrier = carrierRaw === 'JNT' ? 'JNT' : 'VET';
    const shippingCost = shippingCarrier === 'JNT' ? jntFee : vetFee;

    let discount = 0;
    let normalizedCouponCode: string | null = null;
    if (couponCode && String(couponCode).trim()) {
      normalizedCouponCode = String(couponCode).trim().toUpperCase();
      const coupon = await prisma.coupon.findUnique({
        where: { code: normalizedCouponCode, isActive: true },
      });
      if (!coupon) throw new AppError('Invalid coupon code', 400);
      if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new AppError('Coupon has expired', 400);
      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw new AppError('Coupon usage limit reached', 400);
      if (coupon.minOrder && subtotal < coupon.minOrder) {
        throw new AppError(`Minimum order is ${coupon.minOrder} for this coupon`, 400);
      }
      if (coupon.discountType === 'PERCENTAGE') {
        discount = (subtotal * coupon.discount) / 100;
        if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
      } else {
        discount = coupon.discount;
      }
      discount = Math.max(0, Math.min(discount, subtotal));
    }

    const total = subtotal + shippingCost - discount;
    res.json({
      success: true,
      data: { subtotal, shippingCost, discount, total, shippingCarrier, couponCode: normalizedCouponCode },
    });
  } catch (error) {
    next(error);
  }
};

export const getUserOrders = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = '1', limit = '10', status } = req.query;
    const { skip, take, page: pageNum, limit: limitNum } = paginate(Number(page), Number(limit));

    const where: Record<string, unknown> = { userId: req.user!.id, isArchivedByUser: false };
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          items: { select: { id: true, name: true, image: true, price: true, quantity: true } },
          address: true,
        },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({ success: true, ...paginateResponse(orders, total, pageNum, limitNum) });
  } catch (error) {
    next(error);
  }
};

export const getOrder = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const where: Record<string, unknown> = { id };
    if (req.user!.role !== 'ADMIN') {
      where.userId = req.user!.id;
      where.isArchivedByUser = false;
    }

    const order = await prisma.order.findFirst({
      where,
      include: {
        items: {
          include: { product: { select: { id: true, slug: true, images: true } } },
        },
        address: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    });

    if (!order) throw new AppError('Order not found', 404);

    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

export const cancelOrder = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = String(req.params.id);

    const order = await prisma.order.findFirst({
      where: { id, userId: req.user!.id },
      include: { items: true },
    });

    if (!order) throw new AppError('Order not found', 404);

    if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
      throw new AppError('Order cannot be cancelled at this stage', 400);
    }

    await prisma.order.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
    notifyAdminUserCancelledOrder(id).catch((error) => {
      console.error('[Admin Notify] User cancel notification failed:', error);
    });

    // Restore stock
    const orderWithItems = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (orderWithItems) {
      await Promise.all(
        orderWithItems.items.map((item) =>
          prisma.product.update({
            where: { id: item.productId },
            data: {
              stock: { increment: item.quantity },
              soldCount: { decrement: item.quantity },
            },
          })
        )
      );
    }

    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (error) {
    next(error);
  }
};

export const confirmPayment = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { orderId, paymentIntentId } = req.body;

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: req.user!.id },
    });

    if (!order) throw new AppError('Order not found', 404);

    // Verify with Stripe if available
    if (stripeClient && paymentIntentId) {
      try {
        const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentIntentId);
        if (paymentIntent.status === 'succeeded') {
          await prisma.order.update({
            where: { id: orderId },
            data: { status: 'CONFIRMED', paymentStatus: 'PAID', paymentIntentId },
          });
        }
      } catch {
        await prisma.order.update({
          where: { id: orderId },
          data: { status: 'CONFIRMED', paymentStatus: 'PAID' },
        });
      }
    } else {
      // No Stripe — mark as paid directly (test mode)
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'CONFIRMED', paymentStatus: 'PAID' },
      });
    }

    // Re-send invoice after payment confirmation to reflect paid status.
    sendInvoiceNotification(orderId).catch((error) => {
      console.error('[Invoice] Confirmation notification failed:', error);
    });
    notifyAdminOrderEvent(orderId, 'PAYMENT_PAID').catch((error) => {
      console.error('[Admin Notify] Payment notification failed:', error);
    });

    res.json({ success: true, message: 'Payment confirmed' });
  } catch (error) {
    next(error);
  }
};

export const archiveOrderHistory = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = String(req.params.id);
    const order = await prisma.order.findFirst({
      where: { id, userId: req.user!.id },
      select: { id: true },
    });
    if (!order) throw new AppError('Order not found', 404);
    await prisma.order.update({
      where: { id },
      data: { isArchivedByUser: true, archivedAt: new Date() },
    });
    res.json({ success: true, message: 'Order removed from website history' });
  } catch (error) {
    next(error);
  }
};

export const getOrderInvoice = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = String(req.params.id);

    const order = await prisma.order.findFirst({
      where: req.user!.role === 'ADMIN' ? { id } : { id, userId: req.user!.id },
      select: { id: true },
    });

    if (!order) throw new AppError('Order not found', 404);

    const langRaw = String(req.query.lang || '').toLowerCase();
    const lang = langRaw === 'en' || langRaw === 'zh' || langRaw === 'km' ? langRaw : 'km';
    const invoice = await getInvoiceDetails(id, lang);
    if (!invoice) throw new AppError('Invoice not found', 404);

    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};

// Admin controllers
export const adminGetOrders = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = '1', limit = '20', status, search } = req.query;
    const { skip, take, page: pageNum, limit: limitNum } = paginate(Number(page), Number(limit));

    const where: Record<string, unknown> = {};
    if (status) where.status = String(status);
    if (search) {
      where.OR = [
        { orderNumber: { contains: String(search) } },
        { user: { email: { contains: String(search) } } },
        { user: { name: { contains: String(search) } } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          items: { select: { id: true, name: true, quantity: true, price: true } },
          address: true,
        },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({ success: true, ...paginateResponse(orders, total, pageNum, limitNum) });
  } catch (error) {
    next(error);
  }
};

export const adminUpdateOrderStatus = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { status, trackingNumber } = req.body;

    const validStatuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
    if (!validStatuses.includes(status)) {
      throw new AppError('Invalid status', 400);
    }

    const existing = await prisma.order.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) throw new AppError('Order not found', 404);

    const data: Record<string, unknown> = { status };
    if (trackingNumber) data.trackingNumber = trackingNumber;
    if (status === 'SHIPPED') data.shippedAt = new Date();
    if (status === 'DELIVERED') data.deliveredAt = new Date();

    const order = await prisma.order.update({ where: { id }, data });
    if (existing.status !== status) {
      notifyAdminOrderStatusChanged(order.id, existing.status, status).catch((error) => {
        console.error('[Admin Notify] Order status update notification failed:', error);
      });
    }

    res.json({ success: true, message: 'Order status updated', data: order });
  } catch (error) {
    next(error);
  }
};

