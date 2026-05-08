'use client';

import { useEffect, useState } from 'react';
import { settingApi, uploadApi } from '@/lib/api';
import { useAdminLanguageStore } from '@/store/adminLanguageStore';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import type { AdminSettingsForm, HeroSlide, PromoCard, SettingsSection, UILang } from './types';
import SettingsSidebar from './components/SettingsSidebar';
import SectionPager from './components/SectionPager';
import CoreSettingsSection from './components/CoreSettingsSection';
import HeaderSettingsSection from './components/HeaderSettingsSection';
import InvoiceSettingsSection from './components/InvoiceSettingsSection';
import HomepageSettingsSection from './components/HomepageSettingsSection';
import FooterSettingsSection from './components/FooterSettingsSection';
import {
  Loader2,
  Save,
  Settings,
} from 'lucide-react';

const adminSettingsI18n: Record<UILang, Record<string, string>> = {
  km: {
    globalConfigurations: 'ការកំណត់សកល',
    settingsSections: 'ផ្នែកការកំណត់',
    core: 'ការកំណត់មូលដ្ឋាន',
    header: 'Header',
    homepage: 'Homepage Ads',
    footer: 'Footer និងទំនាក់ទំនង',
    invoice: 'ការកំណត់វិក្កយបត្រ',
    saveAll: 'រក្សាទុកការកំណត់ទាំងអស់',
    saving: 'កំពុងរក្សាទុក...',
    next: 'បន្ទាប់',
    previous: 'មុន',
    sectionTip: 'កែតាមផ្នែក ដើម្បីកុំច្រឡំ',
  },
  en: {
    globalConfigurations: 'Global Configurations',
    settingsSections: 'Settings Sections',
    core: 'Core Settings',
    header: 'Header',
    homepage: 'Homepage Ads',
    footer: 'Footer & Contact',
    invoice: 'Invoice Settings',
    saveAll: 'Save All Settings',
    saving: 'Saving...',
    next: 'Next',
    previous: 'Previous',
    sectionTip: 'Edit by section to avoid mistakes',
  },
  zh: {
    globalConfigurations: '全局配置',
    settingsSections: '设置分区',
    core: '核心设置',
    header: '页眉',
    homepage: '首页广告',
    footer: '页脚与联系信息',
    invoice: '发票设置',
    saveAll: '保存所有设置',
    saving: '保存中...',
    next: '下一步',
    previous: '上一步',
    sectionTip: '按分区编辑，避免混淆',
  },
};

const defaultForm = (): AdminSettingsForm => ({
  siteName: 'SH-Shop',
  siteTagline: 'Your trusted online store',
  shippingFeeVet: 1,
  shippingFeeJnt: 1,
  header: {
    siteName: 'SH-Shop',
    logoLetter: 'S',
    navLinks: [],
  },
  footer: {
    brandName: 'SH-Shop',
    brandDescription: 'Online shopping',
    address: 'Phnom Penh',
    phones: ['+855 97 494 4390'],
    email: 'info@sh-shop.com',
    socialLinks: [{ name: 'Facebook', url: 'https://facebook.com' }],
    shopLinks: [{ label: 'All Products', href: '/products' }],
    accountLinks: [{ label: 'My Account', href: '/dashboard' }],
    legalLinks: [{ label: 'Privacy', href: '/legal/privacy' }],
    paymentBadges: ['Visa', 'MC', 'Bakong'],
    copyright: 'All rights reserved.',
  },
  homepage: {
    heroSlides: [
      {
        tag: 'Big sale',
        title: 'Up to',
        subtitle: '50% Off',
        description: 'Edit this slide from Admin Settings',
        cta: 'Shop now',
        ctaHref: '/products',
        bg: 'from-primary-900 via-primary-800 to-indigo-900',
        accent: '#6366f1',
        image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=1200&auto=format&fit=crop',
      },
    ],
    promoCards: [
      {
        tag: 'Limited time',
        title: 'Summer Sale',
        description: 'Up to 50% off selected products',
        cta: 'Shop Electronics',
        ctaHref: '/products?category=electronics',
        image: '',
        gradientFrom: 'from-primary-600',
        gradientTo: 'to-primary-800',
        gradientFromColor: '#4f46e5',
        gradientToColor: '#1e40af',
      },
      {
        tag: 'New members',
        title: 'First Order',
        description: 'Special discount for new account',
        cta: 'Join Now',
        ctaHref: '/register',
        image: '',
        gradientFrom: 'from-amber-500',
        gradientTo: 'to-orange-600',
        gradientFromColor: '#f59e0b',
        gradientToColor: '#ea580c',
      },
    ],
  },
  invoice: {
    shopName: 'SH-Shop',
    supportEmail: 'support@shophub.com',
    supportPhone: '+855 97 494 4390',
    shopAddress: 'Phnom Penh, Cambodia',
    footerNote: 'Thank you for your order.',
    paymentLabelCard: 'Paid by Visa / card',
    paymentLabelBakong: 'Paid by Bakong (KHQR)',
  },
});

const SECTION_ORDER: SettingsSection[] = ['core', 'header', 'homepage', 'footer', 'invoice'];
const addBtn = 'btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1 rounded-xl';
const inputCls = 'input rounded-xl h-11 border-gray-200/80 dark:border-gray-700';
const blockCls = 'rounded-[28px] border border-slate-200/70 dark:border-gray-800 bg-white/95 dark:bg-surface-900/90 backdrop-blur shadow-[0_18px_45px_-24px_rgba(15,23,42,0.35)] dark:shadow-[0_18px_45px_-24px_rgba(0,0,0,0.65)]';
const blockHeadCls = 'flex items-start gap-3 px-6 py-5 border-b border-slate-100 dark:border-gray-800';
const blockBodyCls = 'p-6 space-y-6';
const fieldLabelCls = 'block text-xs font-medium text-slate-500 mb-1.5';
const helperTextCls = 'text-[11px] text-gray-500 mt-1';

const HERO_BG_PRESETS = [
  { label: 'Indigo Night', value: 'from-primary-900 via-primary-800 to-indigo-900' },
  { label: 'Dark Slate', value: 'from-slate-900 via-gray-900 to-zinc-900' },
  { label: 'Rose Purple', value: 'from-rose-900 via-pink-900 to-fuchsia-900' },
  { label: 'Ocean Blue', value: 'from-blue-900 via-cyan-800 to-indigo-900' },
];

const PROMO_BG_PRESETS = [
  { label: 'Primary Blue', from: 'from-primary-600', to: 'to-primary-800', fromColor: '#4f46e5', toColor: '#1e40af' },
  { label: 'Amber Orange', from: 'from-amber-500', to: 'to-orange-600', fromColor: '#f59e0b', toColor: '#ea580c' },
  { label: 'Emerald Teal', from: 'from-emerald-500', to: 'to-teal-600', fromColor: '#10b981', toColor: '#0d9488' },
  { label: 'Violet Pink', from: 'from-violet-600', to: 'to-pink-600', fromColor: '#7c3aed', toColor: '#db2777' },
];

const parseMoneyInput = (value: string): number => {
  const normalized = value.replace(/,/g, '.').trim();
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
};

export default function AdminSettingsPage() {
  const { language } = useAdminLanguageStore();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSection>('core');
  const [form, setForm] = useState<AdminSettingsForm>(defaultForm());
  const uiLang: UILang = language;
  const isKhmer = language === 'km';
  const tx = adminSettingsI18n[uiLang];
  const activeIdx = SECTION_ORDER.indexOf(activeSection);

  useEffect(() => {
    const fromQuery = searchParams.get('section') as SettingsSection | null;
    if (fromQuery && SECTION_ORDER.includes(fromQuery)) {
      setActiveSection(fromQuery);
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await settingApi.get();
        if (!data.success || !data.data) return;
        const d = data.data as {
          siteName?: string;
          shippingFee?: number;
          shippingFeeVet?: number;
          shippingFeeJnt?: number;
          footerInfo?: unknown;
        };
        const base = defaultForm();
        const layout = (d.footerInfo && typeof d.footerInfo === 'object' ? d.footerInfo : {}) as {
          header?: Partial<AdminSettingsForm['header']> & { tagline?: string };
          footer?: Partial<AdminSettingsForm['footer']>;
          homepage?: Partial<AdminSettingsForm['homepage']>;
          invoice?: Partial<AdminSettingsForm['invoice']>;
        };
        const legacy = d.shippingFee ?? 2;
        setForm({
          ...base,
          siteName: d.siteName || base.siteName,
          siteTagline: layout.header?.tagline || base.siteTagline,
          shippingFeeVet: d.shippingFeeVet ?? legacy,
          shippingFeeJnt: d.shippingFeeJnt ?? legacy,
          header: { ...base.header, ...layout.header },
          footer: {
            ...base.footer,
            ...layout.footer,
            phones: Array.isArray(layout.footer?.phones) ? layout.footer!.phones.filter(Boolean) : base.footer.phones,
            socialLinks: Array.isArray(layout.footer?.socialLinks) ? layout.footer!.socialLinks : base.footer.socialLinks,
            shopLinks: Array.isArray(layout.footer?.shopLinks) ? layout.footer!.shopLinks : base.footer.shopLinks,
            accountLinks: Array.isArray(layout.footer?.accountLinks) ? layout.footer!.accountLinks : base.footer.accountLinks,
            legalLinks: Array.isArray(layout.footer?.legalLinks) ? layout.footer!.legalLinks : base.footer.legalLinks,
            paymentBadges: Array.isArray(layout.footer?.paymentBadges) ? layout.footer!.paymentBadges.filter(Boolean) : base.footer.paymentBadges,
          },
          homepage: {
            heroSlides: Array.isArray(layout.homepage?.heroSlides) ? layout.homepage!.heroSlides as HeroSlide[] : base.homepage.heroSlides,
            promoCards: Array.isArray(layout.homepage?.promoCards) ? layout.homepage!.promoCards as PromoCard[] : base.homepage.promoCards,
          },
          invoice: { ...base.invoice, ...layout.invoice },
        });
      } catch {
        toast.error('Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const updateLinkArray = (
    key: 'shopLinks' | 'accountLinks' | 'legalLinks' | 'navLinks',
    idx: number,
    field: 'label' | 'href',
    value: string
  ) => {
    if (key === 'navLinks') {
      const arr = [...form.header.navLinks];
      arr[idx] = { ...arr[idx], [field]: value };
      setForm((p) => ({ ...p, header: { ...p.header, navLinks: arr } }));
      return;
    }
    const arr = [...form.footer[key]];
    arr[idx] = { ...arr[idx], [field]: value };
    setForm((p) => ({ ...p, footer: { ...p.footer, [key]: arr } }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await settingApi.update({
        siteName: form.siteName,
        // Keep legacy fee in sync for backward compatibility.
        shippingFee: form.shippingFeeVet,
        shippingFeeVet: form.shippingFeeVet,
        shippingFeeJnt: form.shippingFeeJnt,
        footerInfo: {
          header: { ...form.header, tagline: form.siteTagline },
          footer: form.footer,
          homepage: form.homepage,
          invoice: form.invoice,
        },
      });
      toast.success('Settings updated successfully');
    } catch {
      toast.error('Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleHomepageImageUpload = async (
    file: File | undefined,
    kind: 'hero' | 'promo',
    idx: number
  ) => {
    if (!file) return;
    const key = `${kind}-${idx}`;
    setUploadingKey(key);
    try {
      const res = await uploadApi.uploadProductImage(file, 'homepage');
      const imageUrl = res.data?.data?.url || '';
      if (!imageUrl) throw new Error('No image URL');
      setForm((prev) => {
        if (kind === 'hero') {
          const heroSlides = [...prev.homepage.heroSlides];
          heroSlides[idx] = { ...heroSlides[idx], image: imageUrl };
          return { ...prev, homepage: { ...prev.homepage, heroSlides } };
        }
        const promoCards = [...prev.homepage.promoCards];
        promoCards[idx] = { ...promoCards[idx], image: imageUrl };
        return { ...prev, homepage: { ...prev.homepage, promoCards } };
      });
      toast.success('Image uploaded');
    } catch {
      toast.error('Image upload failed');
    } finally {
      setUploadingKey(null);
    }
  };

  const goToPrevSection = () => {
    if (activeIdx <= 0) return;
    setActiveSection(SECTION_ORDER[activeIdx - 1]);
  };

  const goToNextSection = () => {
    if (activeIdx >= SECTION_ORDER.length - 1) return;
    setActiveSection(SECTION_ORDER[activeIdx + 1]);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div
      className="max-w-[1500px] mx-auto space-y-6"
      style={isKhmer ? { fontFamily: "'Noto Sans Khmer', 'Khmer OS Siemreap', sans-serif" } : undefined}
    >
      <div className="relative overflow-hidden rounded-[30px] bg-gradient-to-r from-violet-500/15 via-indigo-500/15 to-fuchsia-500/15 border border-primary-100 dark:border-primary-900/30 p-6 shadow-[0_15px_35px_-22px_rgba(79,70,229,0.7)]">
        <div className="pointer-events-none absolute -right-12 -top-12 w-44 h-44 rounded-full bg-primary-400/20 blur-2xl" />
        <h1 className={`text-gray-900 dark:text-white flex items-center gap-2 ${isKhmer ? 'text-[32px] font-bold' : 'text-3xl font-black tracking-tight'}`}>
          <Settings className="w-6 h-6 text-primary-600" />
          {tx.globalConfigurations}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
          Organize and manage store content by sections: shipping, header, homepage ads, footer contact, and invoice info.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full bg-white/70 dark:bg-surface-800 border border-gray-200 dark:border-gray-700">Modern UI</span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-white/70 dark:bg-surface-800 border border-gray-200 dark:border-gray-700">Upload Support</span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-white/70 dark:bg-surface-800 border border-gray-200 dark:border-gray-700">Easy For Admin</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid lg:grid-cols-[260px_1fr] gap-6 items-start">
          <SettingsSidebar
            tx={tx}
            isKhmer={isKhmer}
            activeSection={activeSection}
            onChangeSection={setActiveSection}
          />

          <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
        <CoreSettingsSection
          active={activeSection === 'core'}
          form={form}
          inputCls={inputCls}
          blockCls={blockCls}
          blockHeadCls={blockHeadCls}
          blockBodyCls={blockBodyCls}
          helperTextCls={helperTextCls}
          parseMoneyInput={parseMoneyInput}
          onChangeForm={setForm}
        />

        <HeaderSettingsSection
          active={activeSection === 'header'}
          form={form}
          inputCls={inputCls}
          blockCls={blockCls}
          blockHeadCls={blockHeadCls}
          blockBodyCls={blockBodyCls}
          fieldLabelCls={fieldLabelCls}
          addBtn={addBtn}
          onChangeForm={setForm}
          updateLinkArray={(key, idx, field, value) => updateLinkArray(key, idx, field, value)}
        />

        <HomepageSettingsSection
          active={activeSection === 'homepage'}
          form={form}
          blockCls={blockCls}
          blockHeadCls={blockHeadCls}
          blockBodyCls={blockBodyCls}
          fieldLabelCls={fieldLabelCls}
          addBtn={addBtn}
          uploadingKey={uploadingKey}
          heroBgPresets={HERO_BG_PRESETS}
          promoBgPresets={PROMO_BG_PRESETS}
          defaultHeroSlide={defaultForm().homepage.heroSlides[0]}
          defaultPromoCard={defaultForm().homepage.promoCards[0]}
          onChangeForm={setForm}
          onUploadImage={handleHomepageImageUpload}
        />

        <FooterSettingsSection
          active={activeSection === 'footer'}
          form={form}
          blockCls={blockCls}
          blockHeadCls={blockHeadCls}
          blockBodyCls={blockBodyCls}
          fieldLabelCls={fieldLabelCls}
          addBtn={addBtn}
          onChangeForm={setForm}
          updateLinkArray={(key, idx, field, value) => updateLinkArray(key, idx, field, value)}
        />

        <InvoiceSettingsSection
          active={activeSection === 'invoice'}
          form={form}
          blockCls={blockCls}
          blockHeadCls={blockHeadCls}
          blockBodyCls={blockBodyCls}
          fieldLabelCls={fieldLabelCls}
          onChangeForm={setForm}
        />
          <SectionPager
            previousLabel={tx.previous}
            nextLabel={tx.next}
            canGoPrevious={activeIdx > 0}
            canGoNext={activeIdx < SECTION_ORDER.length - 1}
            onPrevious={goToPrevSection}
            onNext={goToNextSection}
          />
          </motion.div>
          </AnimatePresence>
        </div>

        <div className="sticky bottom-3 z-10 flex justify-end">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPreviewOpen(true)}
              className="btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2.5"
            >
              Preview
            </button>
            <button type="submit" disabled={isSaving} className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 shadow-lg shadow-primary-500/25">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSaving ? tx.saving : tx.saveAll}
            </button>
          </div>
        </div>
      </form>

      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-5xl max-h-[90vh] overflow-auto rounded-3xl border border-white/60 dark:border-gray-700 bg-white dark:bg-surface-900 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-surface-900/95 backdrop-blur">
              <div>
                <h3 className={`text-gray-900 dark:text-white ${isKhmer ? 'text-[22px] font-bold' : 'text-xl font-extrabold tracking-tight'}`}>Preview Before Save</h3>
                <p className={`text-gray-500 ${isKhmer ? 'text-[13px]' : 'text-xs'}`}>Review your changes before applying them</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="btn-secondary px-4 rounded-xl min-h-[42px]"
              >
                {isKhmer ? 'បិទ' : 'Close'}
              </button>
            </div>

            <div className="p-6 space-y-7">
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="px-5 py-3.5 bg-gray-50 dark:bg-surface-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
                  <div className={`text-gray-900 dark:text-white ${isKhmer ? 'text-[16px] font-semibold' : 'font-semibold'}`}>{form.header.siteName}</div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {form.header.navLinks.slice(0, 4).map((n, idx) => (
                      <span key={`${n.label}-${idx}`} className="px-2 py-1 rounded-md bg-white dark:bg-surface-900 border border-gray-200 dark:border-gray-700">
                        {n.label || 'Link'}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  {form.homepage.heroSlides[0] && (
                    <div className={`relative overflow-hidden p-8 text-white bg-gradient-to-br ${form.homepage.heroSlides[0].bg}`}>
                      {form.homepage.heroSlides[0].image ? (
                        <div
                          className="absolute inset-0 opacity-25 bg-cover bg-center"
                          style={{ backgroundImage: `url(${form.homepage.heroSlides[0].image})` }}
                        />
                      ) : null}
                      <div className="relative z-10 max-w-2xl">
                        <p className="text-xs uppercase tracking-wide opacity-85">{form.homepage.heroSlides[0].tag}</p>
                        <h4 className="text-3xl font-bold mt-1">
                          {form.homepage.heroSlides[0].title} {form.homepage.heroSlides[0].subtitle}
                        </h4>
                        <p className="text-sm mt-2 opacity-90">{form.homepage.heroSlides[0].description}</p>
                        <button
                          type="button"
                          className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold"
                          style={{ backgroundColor: form.homepage.heroSlides[0].accent }}
                        >
                          {form.homepage.heroSlides[0].cta}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-5 grid md:grid-cols-2 gap-4 md:gap-5 bg-white dark:bg-surface-900">
                  {form.homepage.promoCards.slice(0, 2).map((card, i) => (
                    <div
                      key={`preview-card-${i}`}
                      className={`relative overflow-hidden rounded-xl text-white p-4 bg-gradient-to-br ${card.gradientFrom} ${card.gradientTo}`}
                      style={
                        card.gradientFromColor && card.gradientToColor
                          ? { backgroundImage: `linear-gradient(135deg, ${card.gradientFromColor}, ${card.gradientToColor})` }
                          : undefined
                      }
                    >
                      {card.image ? (
                        <div
                          className="absolute inset-0 opacity-20 bg-cover bg-center"
                          style={{ backgroundImage: `url(${card.image})` }}
                        />
                      ) : null}
                      <div className="relative z-10">
                        <p className="text-xs opacity-80">{card.tag}</p>
                        <p className="font-semibold">{card.title}</p>
                        <p className="text-xs opacity-85">{card.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800 space-y-1">
                  <div className="text-sm font-semibold">{form.footer.brandName}</div>
                  <div className="text-xs text-gray-500">{form.footer.address}</div>
                  <div className="text-xs text-gray-500">{form.footer.email}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
                <p className={`text-gray-500 mb-2 ${isKhmer ? 'text-[13px] font-medium' : 'text-xs uppercase tracking-wide'}`}>Invoice Snapshot</p>
                <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-4">
                  <p className="font-semibold">{form.invoice.shopName}</p>
                  <p className="text-sm text-gray-500">{form.invoice.supportEmail} • {form.invoice.supportPhone}</p>
                  <p className="text-sm text-gray-500">{form.invoice.shopAddress}</p>
                  <p className="text-sm mt-3 text-gray-600 dark:text-gray-300">{form.invoice.footerNote}</p>
                  <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900 p-3">
                      VET Fee: ${form.shippingFeeVet.toFixed(2)}
                    </div>
                    <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 p-3">
                      J&T Fee: ${form.shippingFeeJnt.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
