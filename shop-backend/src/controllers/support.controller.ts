import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';

type Inquiry = {
  id: string;
  name: string;
  phone: string;
  question: string;
  priority: 'ORDER' | 'PAYMENT' | 'PRODUCT' | 'GENERAL';
  transcript: string;
  createdAt: string;
};

const inquiries: Inquiry[] = [];

const inferPriority = (text: string): Inquiry['priority'] => {
  const s = String(text || '').toLowerCase();
  if (/(ord-|order|tracking|ship|deliver|cancel)/.test(s)) return 'ORDER';
  if (/(pay|payment|bakong|visa|master|refund|card)/.test(s)) return 'PAYMENT';
  if (/(product|stock|color|size|variant|price)/.test(s)) return 'PRODUCT';
  return 'GENERAL';
};

export const createSupportInquiry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, phone, question, priority, transcript } = req.body as {
      name?: string;
      phone?: string;
      question?: string;
      priority?: Inquiry['priority'];
      transcript?: string;
    };
    if (!name || !phone || !question) {
      res.status(400).json({ success: false, message: 'Name, phone and question are required' });
      return;
    }
    const p = priority || inferPriority(question);
    const inquiry: Inquiry = {
      id: `inq_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: String(name),
      phone: String(phone),
      question: `[PRIORITY:${p}] ${String(question)}`,
      priority: p,
      transcript: String(transcript || ''),
      createdAt: new Date().toISOString(),
    };
    inquiries.unshift(inquiry);
    res.status(201).json({ success: true, message: 'Inquiry created', data: inquiry });
  } catch (error) {
    next(error);
  }
};

export const listSupportInquiries = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.json({ success: true, data: inquiries });
  } catch (error) {
    next(error);
  }
};
