import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendEmail } from '../lib/notifier';

/** Letters from any script + spaces and common punctuation (Khmer/Latin names). */
const DISPLAY_NAME_PATTERN = /^[\p{L}\p{M}\s'.-]+$/u;

const normalizePhoneDigits = (raw: string): string => raw.replace(/\D/g, '');
const forgotPasswordCodes = new Map<string, { code: string; expiresAt: number }>();

const signToken = (payload: { id: string; email: string; role: string; name: string }) => {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  } as jwt.SignOptions);
};

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !password || !phone) {
      throw new AppError('Name, phone and password are required', 400);
    }

    if (!DISPLAY_NAME_PATTERN.test(String(name).trim())) {
      throw new AppError('Name can contain letters only', 400);
    }

    const phoneDigits = normalizePhoneDigits(String(phone));
    if (!/^\d{8,15}$/.test(phoneDigits)) {
      throw new AppError('Phone can contain numbers only (8-15 digits)', 400);
    }

    const rawEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const emailStr = rawEmail || null;
    if (emailStr && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
      throw new AppError('Invalid email format: use something like name@example.com', 400);
    }

    const passwordValue = String(password);
    const hasLower = /[a-z]/.test(passwordValue);
    const hasUpper = /[A-Z]/.test(passwordValue);
    const hasNumber = /\d/.test(passwordValue);
    const hasSpecial = /[^A-Za-z0-9]/.test(passwordValue);
    if (passwordValue.length < 8 || !hasLower || !hasUpper || !hasNumber || !hasSpecial) {
      throw new AppError('Password must include upper, lower, number, special character and be at least 8 characters', 400);
    }

    if (emailStr) {
      const existingByEmail = await prisma.user.findUnique({ where: { email: emailStr } });
      if (existingByEmail) throw new AppError('Email already registered', 409);
    }
    const existingByPhone = await prisma.user.findFirst({ where: { phone: phoneDigits } });
    if (existingByPhone) throw new AppError('Phone already registered', 409);

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { name: String(name).trim(), email: emailStr, phone: phoneDigits, password: hashedPassword },
      select: { id: true, name: true, email: true, phone: true, role: true, avatar: true, createdAt: true },
    });

    // Create empty cart for new user
    await prisma.cart.create({ data: { userId: user.id } });

    const token = signToken({ id: user.id, email: user.email || '', role: user.role, name: user.name });

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: { user, token },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { identifier, email, phone, password } = req.body;
    const loginId = String(identifier || email || phone || '').trim();

    if (!loginId || !password) {
      throw new AppError('Phone/email and password are required', 400);
    }

    const digits = normalizePhoneDigits(loginId);
    const isEmail = /@/.test(loginId);
    const user = await prisma.user.findFirst({
      where: isEmail ? { email: loginId.toLowerCase() } : { phone: digits || loginId },
    });

    if (!user || !user.isActive) {
      throw new AppError('Invalid credentials', 401);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401);
    }

    const token = signToken({ id: user.id, email: user.email || '', role: user.role, name: user.name });

    const { password: _, ...userWithoutPassword } = user;
    void _;

    res.json({
      success: true,
      message: 'Login successful',
      data: { user: userWithoutPassword, token },
    });
  } catch (error) {
    next(error);
  }
};

export const facebookLogin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { accessToken } = req.body as { accessToken?: string };
    if (!accessToken) throw new AppError('Facebook access token is required', 400);

    let data: any;
    try {
      const fb = await axios.get(
        `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(accessToken)}`
      );
      data = fb.data;
    } catch {
      throw new AppError('Invalid Facebook token', 401);
    }

    if (!data?.id) throw new AppError('Invalid Facebook token', 401);
    const email = (data.email as string | undefined) || `fb_${String(data.id)}@facebook.local`;
    const name = (data.name as string | undefined) || 'Facebook User';
    const avatar = (data?.picture?.data?.url as string | undefined) || null;

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const randomPassword = await bcrypt.hash(`fb_${data.id}_${Date.now()}`, 8);
      user = await prisma.user.create({
        data: {
          email,
          name,
          avatar,
          password: randomPassword,
          emailVerified: true,
        },
      });
      await prisma.cart.create({ data: { userId: user.id } });
    } else if (!user.avatar && avatar) {
      user = await prisma.user.update({ where: { id: user.id }, data: { avatar } });
    }

    const token = signToken({ id: user.id, email: user.email || '', role: user.role, name: user.name });
    const { password: _, ...userWithoutPassword } = user;
    void _;

    res.json({
      success: true,
      message: 'Facebook login successful',
      data: { user: userWithoutPassword, token },
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatar: true,
        role: true,
        createdAt: true,
        _count: { select: { orders: true, reviews: true, wishlist: true, addresses: true } },
      },
    });

    if (!user) throw new AppError('User not found', 404);

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, phone, avatar } = req.body;
    const updateData: { name?: string; phone?: string; avatar?: string } = {};

    if (typeof name !== 'undefined') {
      const trimmedName = String(name).trim();
      if (!trimmedName) throw new AppError('Name is required', 400);
      if (!DISPLAY_NAME_PATTERN.test(trimmedName)) {
        throw new AppError('Name can contain letters only', 400);
      }
      updateData.name = trimmedName;
    }

    if (typeof phone !== 'undefined') {
      const phoneDigits = normalizePhoneDigits(String(phone));
      if (phoneDigits && !/^\d{8,15}$/.test(phoneDigits)) {
        throw new AppError('Phone can contain numbers only (8-15 digits)', 400);
      }
      updateData.phone = phoneDigits || '';
    }

    if (typeof avatar !== 'undefined') {
      updateData.avatar = String(avatar).trim();
    }

    await prisma.user.update({
      where: { id: req.user!.id },
      data: updateData,
    });

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatar: true,
        role: true,
        createdAt: true,
        _count: { select: { orders: true, reviews: true, wishlist: true, addresses: true } },
      },
    });

    res.json({ success: true, message: 'Profile updated', data: user });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new AppError('Current and new password are required', 400);
    }

    const hasLower = /[a-z]/.test(newPassword);
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasNumber = /\d/.test(newPassword);
    const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
    if (newPassword.length < 8 || !hasLower || !hasUpper || !hasNumber || !hasSpecial) {
      throw new AppError('New password must include upper, lower, number, special character and be at least 8 characters', 400);
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw new AppError('User not found', 404);

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) throw new AppError('Current password is incorrect', 400);

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) throw new AppError('New password must be different from current password', 400);

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { password: hashedPassword },
    });

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};

export const requestPasswordResetByEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) throw new AppError('Email is required', 400);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError('Email not found', 404);

    const code = String(Math.floor(100000 + Math.random() * 900000));
    forgotPasswordCodes.set(email, { code, expiresAt: Date.now() + 10 * 60 * 1000 });

    await sendEmail({
      to: email,
      subject: 'Your password reset code',
      text: `Your verification code is ${code}. It expires in 10 minutes.`,
      html: `<p>Your verification code is <b>${code}</b>. It expires in 10 minutes.</p>`,
    });

    res.json({ success: true, message: 'Verification code sent to email' });
  } catch (error) {
    next(error);
  }
};

export const resetPasswordByEmailCode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const code = String(req.body?.code || '').trim();
    const newPassword = String(req.body?.newPassword || '');
    if (!email || !code || !newPassword) throw new AppError('Email, code and newPassword are required', 400);

    const saved = forgotPasswordCodes.get(email);
    if (!saved || saved.expiresAt < Date.now() || saved.code !== code) {
      throw new AppError('Invalid verification code', 400);
    }

    const hasLower = /[a-z]/.test(newPassword);
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasNumber = /\d/.test(newPassword);
    const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
    if (newPassword.length < 8 || !hasLower || !hasUpper || !hasNumber || !hasSpecial) {
      throw new AppError('New password must include upper, lower, number, special character and be at least 8 characters', 400);
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError('User not found', 404);
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword } });
    forgotPasswordCodes.delete(email);

    res.json({ success: true, message: 'Password reset successful' });
  } catch (error) {
    next(error);
  }
};

export const resetPasswordByInfo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const name = String(req.body?.name || '').trim();
    const phone = normalizePhoneDigits(String(req.body?.phone || ''));
    const newPassword = String(req.body?.newPassword || '');
    if (!name || !phone || !newPassword) throw new AppError('Name, phone and newPassword are required', 400);

    const hasLower = /[a-z]/.test(newPassword);
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasNumber = /\d/.test(newPassword);
    const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
    if (newPassword.length < 8 || !hasLower || !hasUpper || !hasNumber || !hasSpecial) {
      throw new AppError('New password must include upper, lower, number, special character and be at least 8 characters', 400);
    }

    const user = await prisma.user.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        phone,
      },
    });
    if (!user) throw new AppError('Provided information is incorrect', 400);

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword } });

    res.json({ success: true, message: 'Password reset successful' });
  } catch (error) {
    next(error);
  }
};
