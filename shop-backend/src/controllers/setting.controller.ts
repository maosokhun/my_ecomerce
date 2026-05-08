import { Request, Response } from 'express';
import prisma from '../lib/prisma';

const defaultFees = (base: number) => ({
  shippingFee: base,
  shippingFeeVet: base,
  shippingFeeJnt: base,
});
const minFee = (value: unknown, fallback: number): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, n);
};

const defaultLayoutInfo = (siteName = 'SH-Shop') => ({
  header: {
    siteName,
    logoLetter: siteName.slice(0, 1).toUpperCase() || 'S',
    navLinks: [],
  },
  footer: {
    brandName: siteName,
    brandDescription: '',
    address: '',
    phones: [],
    email: '',
    socialLinks: [],
    shopLinks: [],
    accountLinks: [],
    legalLinks: [],
    paymentBadges: ['Visa', 'MC', 'PayPal', 'Stripe'],
    copyright: '',
  },
  homepage: {
    heroSlides: [
      {
        tag: 'New season',
        title: 'Premium',
        subtitle: 'Shopping',
        description: 'Discover best products',
        cta: 'Shop Now',
        ctaHref: '/products',
        bg: 'from-primary-900 via-primary-800 to-indigo-900',
        accent: '#6366f1',
        image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&auto=format&fit=crop',
      },
    ],
    promoCards: [
      {
        tag: 'Limited time',
        title: 'Summer Sale',
        description: 'Up to 50% off selected items',
        cta: 'Shop Electronics',
        ctaHref: '/products?category=electronics',
        gradientFrom: 'from-primary-600',
        gradientTo: 'to-primary-800',
      },
      {
        tag: 'New members',
        title: 'First Order',
        description: 'Special discount for new accounts',
        cta: 'Join Now',
        ctaHref: '/register',
        gradientFrom: 'from-amber-500',
        gradientTo: 'to-orange-600',
      },
    ],
  },
  invoice: {
    shopName: siteName,
    supportEmail: 'support@shophub.com',
    supportPhone: '+855 97 494 4390',
    shopAddress: 'Phnom Penh, Cambodia',
    footerNote: 'Thank you for your order.',
    paymentLabelCard: 'Paid by Visa / card',
    paymentLabelBakong: 'Paid by Bakong (KHQR)',
  },
});

/**
 * Get global settings (Public)
 */
export const getSettings = async (req: Request, res: Response) => {
  try {
    let settings = await prisma.siteSettings.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      settings = await prisma.siteSettings.create({
        data: {
          id: 'default',
          siteName: 'SH-Shop',
          ...defaultFees(1.0),
          heroImages: [],
          footerInfo: defaultLayoutInfo('SH-Shop'),
        },
      });
    }

    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('getSettings error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * Update global settings (Admin only)
 */
export const updateSettings = async (req: Request, res: Response) => {
  try {
    const { siteName, shippingFee, shippingFeeVet, shippingFeeJnt, heroImages, footerInfo } = req.body;

    const toNum = (v: unknown) => (v !== undefined && v !== null && v !== '' ? Number(v) : undefined);

    const vet = toNum(shippingFeeVet);
    const jnt = toNum(shippingFeeJnt);
    const legacy = toNum(shippingFee);

    const settings = await prisma.siteSettings.upsert({
      where: { id: 'default' },
      update: {
        ...(siteName && { siteName }),
        ...(legacy !== undefined && { shippingFee: minFee(legacy, 1) }),
        ...(vet !== undefined && { shippingFeeVet: minFee(vet, 1) }),
        ...(jnt !== undefined && { shippingFeeJnt: minFee(jnt, 1) }),
        ...(heroImages !== undefined && { heroImages }),
        ...(footerInfo !== undefined && { footerInfo }),
      },
      create: {
        id: 'default',
        siteName: siteName || 'SH-Shop',
        shippingFee: minFee(legacy, 1.0),
        shippingFeeVet: minFee(vet ?? legacy, 1.0),
        shippingFeeJnt: minFee(jnt ?? legacy, 1.0),
        heroImages: heroImages || [],
        footerInfo: footerInfo || defaultLayoutInfo(siteName || 'SH-Shop'),
      },
    });

    res.json({ success: true, message: 'Settings updated successfully', data: settings });
  } catch (error) {
    console.error('updateSettings error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
