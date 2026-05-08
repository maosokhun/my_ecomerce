'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Facebook, Twitter, Instagram, Youtube, Mail, Phone, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguageStore } from '@/store/languageStore';
import { t } from '@/lib/i18n';
import { leadApi, settingApi } from '@/lib/api';

export function Footer() {
  const { language } = useLanguageStore();
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterPhone, setNewsletterPhone] = useState('');
  const [footerInfo, setFooterInfo] = useState<{
    brandName?: string;
    brandDescription?: string;
    address?: string;
    phones?: string[];
    email?: string;
    socialLinks?: Array<{ name?: string; url?: string }>;
    shopLinks?: Array<{ label?: string; href?: string }>;
    accountLinks?: Array<{ label?: string; href?: string }>;
    legalLinks?: Array<{ label?: string; href?: string }>;
    paymentBadges?: string[];
    copyright?: string;
  }>({});

  useEffect(() => {
    settingApi
      .get()
      .then(({ data }) => {
        const info = (data.data?.footerInfo || {}) as { footer?: unknown };
        if (info.footer && typeof info.footer === 'object') {
          setFooterInfo(info.footer as {
            brandName?: string;
            brandDescription?: string;
            address?: string;
            phones?: string[];
            email?: string;
            socialLinks?: Array<{ name?: string; url?: string }>;
            shopLinks?: Array<{ label?: string; href?: string }>;
            accountLinks?: Array<{ label?: string; href?: string }>;
            legalLinks?: Array<{ label?: string; href?: string }>;
            paymentBadges?: string[];
            copyright?: string;
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    try {
      await leadApi.subscribe({ email: newsletterEmail.trim(), phone: newsletterPhone.trim() || undefined });
      toast.success(t(language, 'newsletterThanks'));
      setNewsletterEmail('');
      setNewsletterPhone('');
    } catch {
      toast.error(language === 'km' ? 'ចុះឈ្មោះបរាជ័យ' : language === 'zh' ? '订阅失败' : 'Subscribe failed');
    }
  };

  const brandName = footerInfo.brandName || 'SH-Shop';
  const brandDescription = footerInfo.brandDescription || t(language, 'footerBrandDesc');
  const fallbackShopLinks = [
    { href: '/products', label: t(language, 'footerAllProducts') },
    { href: '/products?featured=true', label: t(language, 'footerFeaturedDeals') },
    { href: '/products?category=electronics', label: t(language, 'footerElectronics') },
    { href: '/products?category=fashion', label: t(language, 'footerFashion') },
    { href: '/products?category=home-living', label: t(language, 'footerHomeGarden') },
    { href: '/products?sort=createdAt&order=desc', label: t(language, 'footerNewArrivals') },
  ];
  const fallbackAccountLinks = [
    { href: '/dashboard', label: t(language, 'footerMyAccount') },
    { href: '/dashboard/orders', label: t(language, 'footerMyOrders') },
    { href: '/dashboard/wishlist', label: t(language, 'footerWishlist') },
    { href: '/login', label: t(language, 'signIn') },
    { href: '/register', label: t(language, 'signUp') },
  ];
  const fallbackLegalLinks = [
    { href: '/legal/privacy', label: t(language, 'footerPrivacy') },
    { href: '/legal/terms', label: t(language, 'footerTerms') },
    { href: '/legal/cookies', label: t(language, 'footerCookie') },
  ];
  const shopLinks =
    Array.isArray(footerInfo.shopLinks) && footerInfo.shopLinks.length > 0
      ? footerInfo.shopLinks.filter((x) => x?.label && x?.href).map((x) => ({ href: String(x.href), label: String(x.label) }))
      : fallbackShopLinks;
  const accountLinks =
    Array.isArray(footerInfo.accountLinks) && footerInfo.accountLinks.length > 0
      ? footerInfo.accountLinks.filter((x) => x?.label && x?.href).map((x) => ({ href: String(x.href), label: String(x.label) }))
      : fallbackAccountLinks;
  const legalLinks =
    Array.isArray(footerInfo.legalLinks) && footerInfo.legalLinks.length > 0
      ? footerInfo.legalLinks.filter((x) => x?.label && x?.href).map((x) => ({ href: String(x.href), label: String(x.label) }))
      : fallbackLegalLinks;
  const phones =
    Array.isArray(footerInfo.phones) && footerInfo.phones.length > 0
      ? footerInfo.phones.filter(Boolean)
      : ['+855 97 494 4390', '+855 88 545 9115'];
  const email = footerInfo.email || 'info@sh-shop.com';
  const address = footerInfo.address || '247 Beong Salang St, Toul Kork, Phnom Penh';
  const paymentBadges =
    Array.isArray(footerInfo.paymentBadges) && footerInfo.paymentBadges.length > 0
      ? footerInfo.paymentBadges.filter(Boolean)
      : ['Visa', 'MC', 'Bakong'];
  const socialLinks =
    Array.isArray(footerInfo.socialLinks) && footerInfo.socialLinks.length > 0
      ? footerInfo.socialLinks.filter((x) => x?.url)
      : [{ name: 'Facebook', url: '#' }, { name: 'Twitter', url: '#' }, { name: 'Instagram', url: '#' }, { name: 'Youtube', url: '#' }];
  const displayShopLinks = shopLinks.length >= 4 ? shopLinks : fallbackShopLinks;
  const displayAccountLinks = accountLinks.length >= 4 ? accountLinks : fallbackAccountLinks;
  const displayLegalLinks = legalLinks.length >= 2 ? legalLinks : fallbackLegalLinks;
  const displayPhones = phones.length >= 2 ? phones : ['+855 97 494 4390', '+855 88 545 9115'];
  const displayPaymentBadges = paymentBadges.length >= 3 ? paymentBadges : ['Visa', 'MC', 'Bakong'];
  const displaySocialLinks =
    socialLinks.length >= 4
      ? socialLinks
      : [{ name: 'Facebook', url: '#' }, { name: 'Twitter', url: '#' }, { name: 'Instagram', url: '#' }, { name: 'Youtube', url: '#' }];

  return (
    <footer className="bg-surface-950 text-gray-300 mt-20">
      <div className="page-container py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">{brandName.slice(0, 1).toUpperCase()}</span>
              </div>
              <span className="text-white font-bold text-lg">{brandName}</span>
            </Link>
            <p className="text-sm text-gray-400 leading-relaxed mb-5">{brandDescription}</p>
            <div className="flex items-center gap-3">
              {[Facebook, Twitter, Instagram, Youtube].map((Icon, i) => (
                <a
                  key={`social-${i}`}
                  href={displaySocialLinks[i]?.url || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="w-9 h-9 bg-surface-900 hover:bg-primary-600 text-gray-400 hover:text-white rounded-lg flex items-center justify-center transition-all duration-200"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Shop */}
          <div>
            <h3 className="text-white font-semibold mb-4">{t(language, 'footerShop')}</h3>
            <ul className="space-y-3">
              {displayShopLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account */}
          <div>
            <h3 className="text-white font-semibold mb-4">{t(language, 'footerAccount')}</h3>
            <ul className="space-y-3">
              {displayAccountLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white font-semibold mb-4">{t(language, 'footerContact')}</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-sm text-gray-400">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary-400" />
                {address}
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-400">
                <Phone className="w-4 h-4 flex-shrink-0 text-primary-400" />
                {displayPhones.join(' / ')}
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-400">
                <Mail className="w-4 h-4 flex-shrink-0 text-primary-400" />
                {email}
              </li>
            </ul>
            <div className="mt-6">
              <p className="text-sm text-gray-400 mb-3">{t(language, 'footerNewsletter')}</p>
              <form onSubmit={handleNewsletter} className="flex gap-2">
                <div className="flex-1 space-y-2">
                  <input
                    type="email"
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-3 py-2 text-sm bg-surface-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
                  />
                  <input
                    type="text"
                    value={newsletterPhone}
                    onChange={(e) => setNewsletterPhone(e.target.value)}
                    placeholder={language === 'km' ? 'លេខទូរស័ព្ទ (ជម្រើស)' : language === 'zh' ? '手机号（可选）' : 'Phone (optional)'}
                    className="w-full px-3 py-2 text-sm bg-surface-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
                  />
                </div>
                <button type="submit" className="px-4 py-2 h-fit text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors">
                  {t(language, 'footerSubscribe')}
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            {footerInfo.copyright || t(language, 'footerRights')}
          </p>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            {displayLegalLinks.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-white transition-colors">{link.label}</Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {displayPaymentBadges.map((pay) => (
              <span key={pay} className="px-2 py-1 bg-surface-900 text-gray-400 text-xs rounded border border-gray-700">
                {pay}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
