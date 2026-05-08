import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../lib/prisma';

export const createLead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phoneRaw = String(req.body?.phone || '').trim();
    if (!email) {
      res.status(400).json({ success: false, message: 'Email is required' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ success: false, message: 'Invalid email format' });
      return;
    }
    const existing = await prisma.lead.findUnique({ where: { email } });
    if (existing) {
      res.json({ success: true, message: 'Already subscribed' });
      return;
    }
    const phone = phoneRaw ? phoneRaw.replace(/\s+/g, '') : null;
    const row = await prisma.lead.create({
      data: {
        email,
        phone,
      },
      select: {
        id: true,
        email: true,
        phone: true,
        createdAt: true,
      },
    });
    res.status(201).json({
      success: true,
      message: 'Subscribed successfully',
      data: {
        ...row,
        createdAt: row.createdAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const listLeads = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        phone: true,
        createdAt: true,
      },
    });
    res.json({
      success: true,
      data: leads.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
};
