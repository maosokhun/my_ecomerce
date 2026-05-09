'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Package, ShoppingCart, Users, Tag,
  LogOut, Menu, X, Store, Settings, FolderTree, Sun, Moon, ChevronDown, Globe, PanelLeftClose,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { useAdminLanguageStore } from '@/store/adminLanguageStore';
import { authApi } from '@/lib/api';
import { adminT } from '@/lib/admin-i18n';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';

const navItems = [
  { href: '/admin', icon: LayoutDashboard, key: 'navDashboard' },
  { href: '/admin/products', icon: Package, key: 'navProducts' },
  { href: '/admin/categories', icon: FolderTree, key: 'navCategories' },
  { href: '/admin/orders', icon: ShoppingCart, key: 'navOrders' },
  { href: '/admin/users', icon: Users, key: 'navUsers' },
  { href: '/admin/leads', icon: Users, key: 'navLeads' },
  { href: '/admin/support-inbox', icon: Users, key: 'navSupportInbox' },
  { href: '/admin/coupons', icon: Tag, key: 'navCoupons' },
  { href: '/admin/settings', icon: Settings, key: 'navSettings' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, isAuthChecked } = useAuthStore();
  const { isDark, setTheme } = useThemeStore();
  const { language, setLanguage } = useAdminLanguageStore();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [adminUser, setAdminUser] = useState<{ name: string; role: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [compactSidebar, setCompactSidebar] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [liveCounts, setLiveCounts] = useState<{ orders: number | null; users: number | null; leads: number | null }>({
    orders: null,
    users: null,
    leads: null,
  });
  const [badgeFlash, setBadgeFlash] = useState<{ orders: boolean; users: boolean; leads: boolean }>({
    orders: false,
    users: false,
    leads: false,
  });

  useEffect(() => {
    if (!isAuthChecked) return;
    const verifyAdminAccess = async () => {
      try {
        const { data } = await authApi.getMe();
        const me = data.data as { name: string; role: string };
        if (me?.role !== 'ADMIN') {
          router.push('/');
          return;
        }
        setAdminUser(me);
      } catch {
        router.push('/login');
      } finally {
        setIsCheckingAccess(false);
      }
    };
    verifyAdminAccess();
  }, [isAuthChecked, router]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  useEffect(() => {
    if (!isAuthChecked || (!adminUser && user?.role !== 'ADMIN')) return;
    let mounted = true;
    let prevLeads = -1;
    let prevOrders = -1;
    let prevUsers = -1;
    const pull = async () => {
      try {
        const { data } = await adminApi.getUnreadCounts();
        const counts = data.data || {};
        if (!mounted) return;
        setLiveCounts({
          orders: Number(counts.orders || 0),
          users: Number(counts.users || 0),
          leads: Number(counts.leads || 0),
        });
        const nextOrders = Number(counts.orders || 0);
        const nextUsers = Number(counts.users || 0);
        const nextLeads = Number(counts.leads || 0);
        if (prevOrders >= 0 && nextOrders > prevOrders) {
          setBadgeFlash((prev) => ({ ...prev, orders: true }));
          setTimeout(() => setBadgeFlash((prev) => ({ ...prev, orders: false })), 1200);
        }
        if (prevUsers >= 0 && nextUsers > prevUsers) {
          setBadgeFlash((prev) => ({ ...prev, users: true }));
          setTimeout(() => setBadgeFlash((prev) => ({ ...prev, users: false })), 1200);
        }
        if (prevLeads >= 0 && nextLeads > prevLeads) {
          setBadgeFlash((prev) => ({ ...prev, leads: true }));
          setTimeout(() => setBadgeFlash((prev) => ({ ...prev, leads: false })), 1200);
        }
        if (prevLeads >= 0 && Number(counts.leads || 0) > prevLeads) {
          toast.success(language === 'km' ? 'មាន subscriber ថ្មី' : language === 'zh' ? '有新的订阅用户' : 'New subscriber arrived');
        }
        prevOrders = nextOrders;
        prevUsers = nextUsers;
        prevLeads = nextLeads;
      } catch {
        // ignore
      }
    };
    pull();
    const timer = setInterval(pull, 8000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [isAuthChecked, adminUser, user?.role, language]);

  useEffect(() => {
    if (!isAuthChecked || (!adminUser && user?.role !== 'ADMIN')) return;
    const type = pathname === '/admin/orders'
      ? 'orders'
      : pathname === '/admin/users'
        ? 'users'
        : pathname === '/admin/leads'
          ? 'leads'
          : null;
    if (!type) return;

    // Same behavior as chat unread: open page => mark seen immediately.
    adminApi.markSeen(type).catch(() => {});
    setLiveCounts((prev) => ({
      ...prev,
      [type]: 0,
    }));
  }, [pathname, isAuthChecked, adminUser, user?.role]);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toggleCompactSidebar = () => {
    setCompactSidebar((prev) => !prev);
  };

  if (!isAuthChecked || isCheckingAccess) return null;
  if (!adminUser && user?.role !== 'ADMIN') return null;
  const activeUser = user || adminUser;
  const langLabel = language === 'km' ? 'ខ្មែរ' : language === 'zh' ? '中文' : 'English';
  const settingsActive = pathname.startsWith('/admin/settings');
  const isKhmer = language === 'km';
  const currentNav = navItems.find((item) => item.href === pathname);
  const pageTitle = adminT(language, currentNav?.key || 'navDashboard');
  const headerKicker = isKhmer ? 'មជ្ឈមណ្ឌលគ្រប់គ្រង' : adminT(language, 'controlCenter');
  const headerHint =
    pathname === '/admin'
      ? adminT(language, 'dashboardOverview')
      : `${adminT(language, 'controlCenter')} / ${pageTitle}`;

  return (
    <div
      className="min-h-screen bg-slate-100 dark:bg-surface-950 flex relative overflow-hidden font-sans"
      style={isKhmer ? { fontFamily: "'Noto Sans Khmer', 'Khmer OS Siemreap', sans-serif" } : undefined}
    >
      <div className="pointer-events-none absolute -top-20 -right-16 w-80 h-80 rounded-full bg-primary-200/40 dark:bg-primary-900/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 w-96 h-96 rounded-full bg-indigo-200/30 dark:bg-indigo-900/20 blur-3xl" />
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 ${compactSidebar ? 'w-[92px]' : 'w-[280px]'} bg-white/92 dark:bg-surface-900/92 backdrop-blur-xl border-r border-white/70 dark:border-gray-800/80 shadow-xl shadow-slate-300/50 dark:shadow-black/20 transform transition-all duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex flex-col h-full">
          <div className={`p-4 border-b border-gray-100/80 dark:border-gray-800 ${compactSidebar ? 'space-y-3' : ''}`}>
            <div className={`flex items-center ${compactSidebar ? 'justify-center' : 'justify-between'} gap-2`}>
              <Link href="/" className={`flex items-center ${compactSidebar ? 'justify-center' : ''} gap-2.5`}>
                <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 text-white flex items-center justify-center shadow-sm">
                  <Store className="w-4.5 h-4.5" />
                </span>
                {!compactSidebar && (
                  <span className={`font-semibold text-gray-900 dark:text-white text-[15px] ${isKhmer ? '' : 'tracking-tight'}`}>
                    SH Shop Admin
                  </span>
                )}
              </Link>
              {!compactSidebar && (
                <button
                  type="button"
                  onClick={toggleCompactSidebar}
                  className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-800 border border-gray-200 dark:border-gray-700"
                  title="Compact"
                >
                  <PanelLeftClose className="w-4 h-4" />
                  Compact
                </button>
              )}
            </div>
            {compactSidebar && (
              <button
                type="button"
                onClick={toggleCompactSidebar}
                className="hidden lg:inline-flex mx-auto px-2.5 py-1 text-[11px] font-medium rounded-md text-gray-500 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-surface-800 border border-gray-200 dark:border-gray-700"
                title="Expand sidebar"
              >
                Expand
              </button>
            )}
          </div>

          <nav className="flex-1 p-4 space-y-2">
            {!compactSidebar && (
              <p className="px-3 pb-1 text-[11px] font-semibold tracking-wide uppercase text-gray-400">
                {isKhmer ? 'មុខងារសំខាន់' : 'Main Navigation'}
              </p>
            )}
            {navItems.map(({ href, icon: Icon, key }) => {
              const label = adminT(language, key);
              const isActive = pathname === href;
              if (href === '/admin/settings') {
                return (
                  <div
                    key={href}
                    className="relative group"
                    onMouseEnter={() => setSettingsOpen(true)}
                    onMouseLeave={() => setSettingsOpen(false)}
                  >
                    <button
                      type="button"
                      onClick={() => setSettingsOpen((v) => !v)}
                      title={compactSidebar ? label : undefined}
                      className={`group w-full h-11 flex items-center ${compactSidebar ? 'justify-center' : 'justify-between'} gap-3 px-3 rounded-xl text-sm font-medium transition-all ${
                        settingsActive
                          ? 'bg-gradient-to-r from-primary-500 to-indigo-500 text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50/90 dark:hover:bg-surface-800 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <span className={`w-6 h-6 flex items-center justify-center ${settingsActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-200'}`}>
                          <Icon className="w-[18px] h-[18px]" />
                        </span>
                        {!compactSidebar && label}
                      </span>
                      {!compactSidebar && <ChevronDown className={`w-4 h-4 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />}
                    </button>
                    {compactSidebar && (
                      <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 rounded-lg bg-gray-900 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition">
                        {label}
                      </span>
                    )}
                    {settingsOpen && (
                      <div className={`${compactSidebar ? 'absolute left-full top-0 ml-2 w-40' : 'mt-1 ml-6'} p-1 rounded-xl border border-gray-200/80 dark:border-gray-700 bg-white/90 dark:bg-surface-900/90 backdrop-blur shadow-sm`}>
                        {[
                          { q: 'core', label: 'Core' },
                          { q: 'header', label: 'Header' },
                          { q: 'homepage', label: 'Homepage Ads' },
                          { q: 'footer', label: 'Footer' },
                          { q: 'invoice', label: 'Invoice' },
                        ].map((child) => (
                          <Link
                            key={child.q}
                            href={`/admin/settings?section=${child.q}`}
                            onClick={() => setSidebarOpen(false)}
                            className="block px-3 py-1.5 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600"
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setSidebarOpen(false)}
                  title={compactSidebar ? label : undefined}
                  className={`group relative flex items-center gap-3 px-3 h-11 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-primary-500 to-indigo-500 text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50/90 dark:hover:bg-surface-800 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <span className={`w-6 h-6 flex items-center justify-center ${isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-200'}`}>
                    <Icon className="w-[18px] h-[18px]" />
                  </span>
                  {!compactSidebar && (
                    <span className="flex items-center justify-between w-full">
                      <span>{label}</span>
                      {(href === '/admin/orders' || href === '/admin/users' || href === '/admin/leads') && (
                        <span
                          className={`ml-2 min-w-5 h-5 px-1 rounded-full text-[10px] font-semibold inline-flex items-center justify-center ${
                            ((href === '/admin/orders' ? (liveCounts.orders ?? 0) : href === '/admin/users' ? (liveCounts.users ?? 0) : (liveCounts.leads ?? 0)) > 0)
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                              : 'bg-gray-100 text-gray-500 dark:bg-surface-800 dark:text-gray-400'
                          }`}
                        >
                          <span
                            className={
                              (href === '/admin/orders' && badgeFlash.orders) ||
                              (href === '/admin/users' && badgeFlash.users) ||
                              (href === '/admin/leads' && badgeFlash.leads)
                                ? 'animate-pulse'
                                : ''
                            }
                          >
                          {href === '/admin/orders'
                            ? (liveCounts.orders ?? 0)
                            : href === '/admin/users'
                              ? (liveCounts.users ?? 0)
                              : (liveCounts.leads ?? 0)}
                          </span>
                        </span>
                      )}
                    </span>
                  )}
                  {compactSidebar && (
                    <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 rounded-lg bg-gray-900 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition">
                      {label}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-primary-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                {activeUser?.name?.[0] || 'A'}
              </div>
              {!compactSidebar && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold tracking-tight text-gray-900 dark:text-white truncate">{activeUser?.name}</p>
                  <p className="text-xs text-gray-400">{adminT(language, 'administrator')}</p>
                </div>
              )}
            </div>
            <button
              onClick={() => { logout(); router.push('/'); }}
              className={`flex items-center ${compactSidebar ? 'justify-center' : 'gap-2'} w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors`}
            >
              <LogOut className="w-4 h-4" /> {!compactSidebar && adminT(language, 'signOut')}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className={`flex-1 ${compactSidebar ? 'lg:ml-[92px]' : 'lg:ml-[280px]'} flex flex-col relative z-10 transition-all duration-300`}>
        <header
          className={`sticky top-0 z-30 px-5 h-[68px] flex items-center gap-4 transition-all duration-200 ${
            isScrolled
              ? 'bg-white/96 dark:bg-surface-900/96 backdrop-blur-xl border-b border-slate-200/80 dark:border-gray-800 shadow-md shadow-slate-200/30 dark:shadow-black/15'
              : 'bg-white/94 dark:bg-surface-900/92 backdrop-blur-xl border-b border-slate-100/90 dark:border-gray-800'
          }`}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-surface-800 rounded-lg"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex-1 min-w-0">
            <p
              className={`text-[10px] font-semibold text-slate-400 dark:text-slate-500 ${
                isKhmer ? '' : 'uppercase tracking-[0.14em]'
              }`}
            >
              {headerKicker}
            </p>
            <p
              className={`leading-[1.1] text-gray-900 dark:text-white truncate ${
                isKhmer ? 'text-[20px] font-semibold tracking-normal' : 'text-[26px] font-extrabold tracking-tight'
              }`}
            >
              {pageTitle}
            </p>
            <p className={`hidden lg:block mt-0.5 truncate text-slate-500 dark:text-slate-400 ${isKhmer ? 'text-[12px]' : 'text-xs'}`}>
              {headerHint}
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 p-1 rounded-2xl bg-slate-50/80 dark:bg-surface-800/70 border border-slate-200/70 dark:border-gray-700/70">
            <div className="relative">
              <button
                type="button"
                onClick={() => setLangOpen((v) => !v)}
                className="inline-flex items-center gap-2 text-sm bg-white dark:bg-surface-800/90 border border-slate-200 dark:border-gray-700 px-3 py-1.5 rounded-xl text-gray-700 dark:text-gray-200 hover:border-primary-300 dark:hover:border-primary-700 transition"
              >
                <Globe className="w-4 h-4 text-primary-500" />
                {langLabel}
                <ChevronDown className={`w-4 h-4 transition-transform ${langOpen ? 'rotate-180' : ''}`} />
              </button>
              {langOpen && (
                <div className="absolute right-0 mt-2 w-36 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-surface-900/95 backdrop-blur shadow-xl overflow-hidden z-30">
                  {[
                    { id: 'km', label: 'ខ្មែរ' },
                    { id: 'en', label: 'English' },
                    { id: 'zh', label: '中文' },
                  ].map((item) => {
                    const active = language === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setLanguage(item.id as 'km' | 'en' | 'zh');
                          setLangOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm transition ${
                          active
                            ? 'bg-gradient-to-r from-primary-500 to-indigo-500 text-white'
                            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-surface-800'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex items-center bg-white dark:bg-surface-800 border border-slate-200 dark:border-gray-700 rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => setTheme(false)}
                className={`px-2.5 py-1.5 rounded-xl transition ${!isDark ? 'bg-primary-500 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-surface-700'}`}
                title="Light mode"
              >
                <Sun className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setTheme(true)}
                className={`px-2.5 py-1.5 rounded-xl transition ${isDark ? 'bg-primary-500 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-surface-700'}`}
                title="Dark mode"
              >
                <Moon className="w-4 h-4" />
              </button>
            </div>
          </div>
          <Link href="/" className="text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-primary-600 bg-white dark:bg-surface-800 border border-slate-200 dark:border-gray-700 px-3 py-1.5 rounded-xl transition">← {adminT(language, 'backToStore')}</Link>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8 w-full">{children}</main>
      </div>
    </div>
  );
}
