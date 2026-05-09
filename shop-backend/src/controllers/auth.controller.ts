import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendEmail, sendTelegramMessage } from '../lib/notifier';

/** Letters from any script + spaces, hyphen, apostrophe, period (Khmer/Latin names). Hyphen first so it is not parsed as a range. */
const DISPLAY_NAME_PATTERN = /^[-\p{L}\p{M}\s'.]+$/u;

const normalizePhoneDigits = (raw: string): string => raw.replace(/\D/g, '');
const forgotPasswordCodes = new Map<string, { code: string; expiresAt: number }>();

const signToken = (payload: { id: string; email: string; role: string; name: string }) => {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  } as jwt.SignOptions);
};

const parseCsv = (value?: string): string[] =>
  String(value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

const resolveTelegramTargets = (): string[] =>
  parseCsv(
    process.env.TELEGRAM_USER_CHAT_IDS ||
      process.env.TELEGRAM_USER_CHAT_ID ||
      process.env.TELEGRAM_CHAT_IDS ||
      process.env.TELEGRAM_CHAT_ID
  );

const resolveTelegramBotToken = (): string | undefined =>
  process.env.TELEGRAM_USER_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;

const formatDateTime24 = (value: Date): string =>
  value.toLocaleString('en-US', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

const getRequestIp = (req: Request): string => {
  const xfwd = req.headers['x-forwarded-for'];
  if (typeof xfwd === 'string' && xfwd.trim()) return xfwd.split(',')[0].trim();
  if (Array.isArray(xfwd) && xfwd[0]) return String(xfwd[0]).trim();
  return req.ip || req.socket?.remoteAddress || 'unknown';
};

/** Short display ID for Telegram: U + 9 digits, stable per DB id (not the raw cuid). */
const formatPublicUserId = (id: string): string => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const n = (h % 900_000_000) + 100_000_000;
  return `U${n}`;
};

/** Rough city/country from IP (HTTPS, no API key). Fails silently if offline/rate-limited. */
const lookupIpGeo = async (ip: string): Promise<string | null> => {
  if (!ip || ip === 'unknown') return null;
  if (ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.')) return null;
  if (process.env.DISABLE_IP_GEO_LOOKUP === '1' || process.env.DISABLE_IP_GEO_LOOKUP === 'true') return null;
  try {
    const { data } = await axios.get<{
      success?: boolean;
      city?: string;
      region?: string;
      country?: string;
      message?: string;
    }>(`https://ipwho.is/${encodeURIComponent(ip)}`, { timeout: 2800 });
    if (data?.success === false) return null;
    const parts = [data.city, data.region, data.country].filter((p): p is string => Boolean(p && String(p).trim()));
    return parts.length ? parts.join(', ') : null;
  } catch {
    return null;
  }
};

/** Guess phone / tablet / desktop + OS + browser from User-Agent (heuristic only). */
const summarizeDeviceFromUserAgent = (uaRaw: string): string => {
  const ua = uaRaw.slice(0, 500);
  if (!ua || ua === 'unknown') return 'មិនស្គាល់';

  const hasAndroid = /Android/i.test(ua);
  const androidMobile = hasAndroid && /Mobile/i.test(ua);
  const isIpad = /iPad/i.test(ua);
  const isIphone = /iPhone|iPod/i.test(ua);
  const tablet =
    isIpad || (hasAndroid && !androidMobile) || /Tablet|PlayBook|Silk\//i.test(ua);
  const phone =
    isIphone ||
    androidMobile ||
    /webOS|BlackBerry|IEMobile|Opera Mini|Mobile Safari.*\bMobile\b/i.test(ua);
  const formFactor = tablet ? 'Tablet' : phone ? 'ទូរស័ព្ទ' : 'កុំព្យូទ័រ';

  let os = 'unknown';
  if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/CrOS/i.test(ua)) os = 'ChromeOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'unknown';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera\//i.test(ua)) browser = 'Opera';
  else if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Internet';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari/i.test(ua) && /Version\//i.test(ua)) browser = 'Safari';

  return `${formFactor} · ${os} · ${browser}`;
};

const notifyTelegramAuthEvent = async (
  req: Request,
  user: { id: string; name: string; email?: string | null; phone?: string | null },
  event: 'REGISTER' | 'LOGIN'
): Promise<void> => {
  const targets = resolveTelegramTargets();
  if (targets.length === 0) return;
  const title = event === 'REGISTER' ? '🆕 អ្នកប្រើប្រាស់បានចុះឈ្មោះ' : '🔐 អ្នកប្រើប្រាស់បានចូលគណនី';
  const ip = getRequestIp(req);
  const geo = await lookupIpGeo(ip);
  const ua = String(req.headers['user-agent'] || 'unknown').slice(0, 500);
  const text = [
    title,
    `ឈ្មោះ: ${user.name || 'មិនមាន'}`,
    `អ៊ីមែល: ${user.email || 'មិនមាន'}`,
    `ទូរស័ព្ទ: ${user.phone || 'មិនមាន'}`,
    `IP Address: ${ip}`,
    `ទីតាំង (ប៉ាន់ប្រមាណតាម IP): ${geo || 'មិនអាចស្គាល់ / មិនបានសួរ'}`,
    `ឧបករណ៍ (ប៉ាន់ប្រមាណតាម User-Agent): ${summarizeDeviceFromUserAgent(ua)}`,
    `កម្មវិធីរុករក (User-Agent ពេញ): ${ua}`,
    `  ↳ ជាព័ត៌មាន browser + OS ដែលកម្មវិធីផ្ញើមក (មិនមែន GPS)។ អាចក្លែងបន្លំបាន កុំយកជាភស្តុតាងតែមួយ។`,
    `User ID: ${formatPublicUserId(user.id)}`,
    `ថ្ងៃ/ម៉ោង: ${formatDateTime24(new Date())}`,
  ].join('\n');
  const botToken = resolveTelegramBotToken();
  await Promise.allSettled(targets.map((chatId) => sendTelegramMessage({ chatId, text, botToken })));
};

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !password || !phone) {
      throw new AppError('Name, phone and password are required', 400);
    }

    if (!DISPLAY_NAME_PATTERN.test(String(name).trim())) {
      throw new AppError(
        'Name may only include letters (any script), spaces, hyphens (-), apostrophes, and periods',
        400
      );
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
    notifyTelegramAuthEvent(req, user, 'REGISTER').catch((error) => {
      console.error('[Auth Notify] Register Telegram notification failed:', error);
    });

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

    if (!user) {
      throw new AppError('Phone/email is incorrect', 401);
    }

    if (!user.isActive) {
      throw new AppError('Your account is inactive', 403);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new AppError('Password is incorrect', 401);
    }

    const token = signToken({ id: user.id, email: user.email || '', role: user.role, name: user.name });
    notifyTelegramAuthEvent(req, user, 'LOGIN').catch((error) => {
      console.error('[Auth Notify] Login Telegram notification failed:', error);
    });

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

/** Sign in with Google (GIS id_token). Set GOOGLE_CLIENT_ID to your Web client ID (same value as NEXT_PUBLIC_GOOGLE_CLIENT_ID on Vercel). */
export const googleLogin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { credential } = req.body as { credential?: string };
    if (!credential) throw new AppError('Google credential is required', 400);
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!clientId) throw new AppError('Google sign-in is not configured on server', 503);

    let payload: Record<string, string | undefined>;
    try {
      const { data } = await axios.get<Record<string, string | undefined>>(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
        { timeout: 10000 }
      );
      payload = data;
    } catch {
      throw new AppError('Invalid Google credential', 401);
    }

    if (payload.error) throw new AppError('Invalid Google credential', 401);
    const aud = payload.aud;
    const azp = payload.azp;
    if (aud !== clientId && azp !== clientId) {
      throw new AppError('Invalid Google credential audience', 401);
    }

    const verified = String(payload.email_verified || '').toLowerCase();
    if (verified === 'false') throw new AppError('Google email is not verified', 401);

    const emailRaw = payload.email?.toLowerCase().trim();
    if (!emailRaw) throw new AppError('Google account has no email', 401);

    const sub = payload.sub || '';
    const name = (payload.name || '').trim() || emailRaw.split('@')[0] || 'Google User';
    const picture = payload.picture || undefined;

    let user = await prisma.user.findUnique({ where: { email: emailRaw } });
    const isNew = !user;
    if (!user) {
      const randomPassword = await bcrypt.hash(`google_${sub}_${Date.now()}`, 12);
      user = await prisma.user.create({
        data: {
          email: emailRaw,
          name,
          avatar: picture || null,
          password: randomPassword,
          emailVerified: true,
        },
      });
      await prisma.cart.create({ data: { userId: user.id } });
    } else {
      const updates: { name?: string; avatar?: string | null } = {};
      if (name && user.name !== name) updates.name = name;
      if (picture && !user.avatar) updates.avatar = picture;
      if (Object.keys(updates).length) {
        user = await prisma.user.update({ where: { id: user.id }, data: updates });
      }
    }

    const token = signToken({ id: user.id, email: user.email || '', role: user.role, name: user.name });
    notifyTelegramAuthEvent(
      req,
      { id: user.id, name: user.name, email: user.email, phone: user.phone },
      isNew ? 'REGISTER' : 'LOGIN'
    ).catch((error) => {
      console.error('[Auth Notify] Google Telegram notification failed:', error);
    });

    const { password: _, ...userWithoutPassword } = user;
    void _;

    res.json({
      success: true,
      message: isNew ? 'Google registration successful' : 'Google login successful',
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
        throw new AppError(
          'Name may only include letters (any script), spaces, hyphens (-), apostrophes, and periods',
          400
        );
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
