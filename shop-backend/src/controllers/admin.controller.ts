import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { paginate, paginateResponse } from '../utils/helpers';

const adminSeenState = new Map<string, { ordersAt?: Date; usersAt?: Date; leadsAt?: Date }>();

export const getDashboardStats = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalOrders,
      totalOrdersLastMonth,
      totalRevenue,
      totalRevenueLastMonth,
      totalUsers,
      totalUsersLastMonth,
      totalProducts,
      recentOrders,
      topProducts,
      ordersByStatus,
      revenueByDay,
      lowStockCount,
      stockValueAgg,
      inventoryAgg,
      lowStockProducts,
    ] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.order.count({ where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
      prisma.order.aggregate({
        where: { paymentStatus: 'PAID', createdAt: { gte: startOfMonth } },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: { paymentStatus: 'PAID', createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
        _sum: { total: true },
      }),
      prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.user.count({ where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
      prisma.product.count({ where: { isActive: true } }),
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, email: true } },
          items: { select: { name: true, quantity: true } },
        },
      }),
      prisma.product.findMany({
        take: 5,
        orderBy: { soldCount: 'desc' },
        select: { id: true, name: true, thumbnail: true, price: true, soldCount: true, stock: true },
      }),
      prisma.order.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      prisma.$queryRaw<{ date: Date; revenue: number }[]>`
        SELECT ("createdAt")::date AS date, SUM("total")::float AS revenue
        FROM orders
        WHERE "paymentStatus" = 'PAID'::"PaymentStatus"
        AND "createdAt" >= ${startOfMonth}
        GROUP BY ("createdAt")::date
        ORDER BY date ASC
      `,
      prisma.product.count({ where: { isActive: true, stock: { lte: 10 } } }),
      prisma.product.aggregate({
        where: { isActive: true },
        _sum: { stock: true },
      }),
      prisma.product.findMany({
        where: { isActive: true },
        select: { stock: true, price: true, costPrice: true, soldCount: true },
      }),
      prisma.product.findMany({
        where: { isActive: true, stock: { lte: 10 } },
        orderBy: { stock: 'asc' },
        take: 8,
        select: { id: true, name: true, stock: true, thumbnail: true },
      }),
    ]);

    const monthGrowth = (current: number, last: number) =>
      last === 0 ? 100 : Math.round(((current - last) / last) * 100);

    const inventoryValue = inventoryAgg.reduce((sum, p) => sum + (p.stock || 0) * (p.costPrice || 0), 0);
    const estimatedRevenueIfSold = inventoryAgg.reduce((sum, p) => sum + (p.stock || 0) * (p.price || 0), 0);
    const realizedGrossProfit = inventoryAgg.reduce(
      (sum, p) => sum + ((p.price || 0) - (p.costPrice || 0)) * (p.soldCount || 0),
      0
    );

    res.json({
      success: true,
      data: {
        overview: {
          orders: {
            value: totalOrders,
            growth: monthGrowth(totalOrders, totalOrdersLastMonth),
          },
          revenue: {
            value: totalRevenue._sum.total || 0,
            growth: monthGrowth(
              totalRevenue._sum.total || 0,
              totalRevenueLastMonth._sum.total || 0
            ),
          },
          users: {
            value: totalUsers,
            growth: monthGrowth(totalUsers, totalUsersLastMonth),
          },
          products: { value: totalProducts },
          stock: {
            lowStockCount,
            totalUnits: stockValueAgg._sum.stock || 0,
            inventoryValue,
            estimatedRevenueIfSold,
          },
          profit: {
            realizedGrossProfit,
          },
        },
        recentOrders,
        topProducts,
        lowStockProducts,
        ordersByStatus: ordersByStatus.map((s) => ({
          status: s.status,
          count: s._count.status,
        })),
        revenueByDay,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getUsers = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = '1', limit = '20', search, role } = req.query;
    const { skip, take, page: pageNum, limit: limitNum } = paginate(Number(page), Number(limit));

    const where: Record<string, unknown> = {};
    if (role) where.role = String(role);
    if (search) {
      where.OR = [
        { name: { contains: String(search) } },
        { email: { contains: String(search) } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, email: true, role: true, isActive: true,
          avatar: true, phone: true, createdAt: true,
          _count: { select: { orders: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ success: true, ...paginateResponse(users, total, pageNum, limitNum) });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { role, isActive } = req.body;

    if (id === req.user!.id) {
      throw new AppError('Cannot modify your own admin account', 400);
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role, isActive },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    res.json({ success: true, message: 'User updated', data: user });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = String(req.params.id);

    if (id === req.user!.id) throw new AppError('Cannot delete your own account', 400);

    await prisma.user.update({ where: { id }, data: { isActive: false } });
    res.json({ success: true, message: 'User deactivated' });
  } catch (error) {
    next(error);
  }
};

export const createCoupon = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { code, description, discountType, discount, minOrder, maxDiscount, usageLimit, expiresAt } = req.body;

    if (!code || !discountType || !discount) {
      throw new AppError('Code, discount type and discount are required', 400);
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: code.toUpperCase(),
        description,
        discountType,
        discount: Number(discount),
        minOrder: minOrder ? Number(minOrder) : null,
        maxDiscount: maxDiscount ? Number(maxDiscount) : null,
        usageLimit: usageLimit ? Number(usageLimit) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    res.status(201).json({ success: true, message: 'Coupon created', data: coupon });
  } catch (error) {
    next(error);
  }
};

export const getCoupons = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: coupons });
  } catch (error) {
    next(error);
  }
};

export const updateCoupon = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { code, description, discountType, discount, minOrder, maxDiscount, usageLimit, expiresAt, isActive } = req.body;
    const coupon = await prisma.coupon.update({
      where: { id },
      data: {
        code: code ? String(code).toUpperCase() : undefined,
        description: typeof description === 'string' ? description : undefined,
        discountType: discountType || undefined,
        discount: typeof discount !== 'undefined' ? Number(discount) : undefined,
        minOrder: typeof minOrder !== 'undefined' ? (minOrder === null || minOrder === '' ? null : Number(minOrder)) : undefined,
        maxDiscount: typeof maxDiscount !== 'undefined' ? (maxDiscount === null || maxDiscount === '' ? null : Number(maxDiscount)) : undefined,
        usageLimit: typeof usageLimit !== 'undefined' ? (usageLimit === null || usageLimit === '' ? null : Number(usageLimit)) : undefined,
        expiresAt: typeof expiresAt !== 'undefined' ? (expiresAt ? new Date(expiresAt) : null) : undefined,
        isActive: typeof isActive === 'boolean' ? isActive : undefined,
      },
    });
    res.json({ success: true, message: 'Coupon updated', data: coupon });
  } catch (error) {
    next(error);
  }
};

export const deleteCoupon = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = String(req.params.id);
    await prisma.coupon.delete({ where: { id } });
    res.json({ success: true, message: 'Coupon deleted' });
  } catch (error) {
    next(error);
  }
};

export const getAdvertisements = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ads = await prisma.advertisement.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: ads });
  } catch (error) {
    next(error);
  }
};

export const getSellerProfiles = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sellers = await prisma.sellerProfile.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        _count: { select: { products: true } },
      },
    });
    res.json({ success: true, data: sellers });
  } catch (error) {
    next(error);
  }
};

export const getUnreadCounts = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const adminId = req.user!.id;
    const seen = adminSeenState.get(adminId) || {};
    const adminMeta = await prisma.user.findUnique({
      where: { id: adminId },
      select: { lastSeenLeadsAt: true },
    });
    const [orders, users, leads] = await Promise.all([
      prisma.order.count({
        where: seen.ordersAt ? { createdAt: { gt: seen.ordersAt } } : undefined,
      }),
      prisma.user.count({
        where: seen.usersAt ? { createdAt: { gt: seen.usersAt } } : undefined,
      }),
      prisma.lead.count({
        where: adminMeta?.lastSeenLeadsAt
          ? { createdAt: { gt: adminMeta.lastSeenLeadsAt } }
          : undefined,
      }),
    ]);

    res.json({ success: true, data: { orders, users, leads } });
  } catch (error) {
    next(error);
  }
};

export const markSeen = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const adminId = req.user!.id;
    const type = String(req.body?.type || '');
    const now = new Date();
    const seen = adminSeenState.get(adminId) || {};
    if (type === 'orders') seen.ordersAt = now;
    else if (type === 'users') seen.usersAt = now;
    else if (type === 'leads') {
      await prisma.user.update({
        where: { id: adminId },
        data: { lastSeenLeadsAt: now },
      });
      seen.leadsAt = now;
    }
    else {
      res.status(400).json({ success: false, message: 'Invalid type' });
      return;
    }
    adminSeenState.set(adminId, seen);
    res.json({ success: true, message: 'Marked as seen' });
  } catch (error) {
    next(error);
  }
};
