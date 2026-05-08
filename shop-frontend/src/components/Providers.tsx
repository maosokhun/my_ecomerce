'use client';

import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { useThemeStore } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { CartDrawer } from './cart/CartDrawer';
import SupportChatWidget from './chat/SupportChatWidget';

export function Providers({ children }: { children: React.ReactNode }) {
  const { isDark } = useThemeStore();
  const { fetchUser, isAuthenticated } = useAuthStore();
  const { fetchCart } = useCartStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    fetchCart();
  }, [isAuthenticated, fetchCart]);

  useEffect(() => {
    const storageKey = '__next_chunk_reload_once';
    const isChunkFailureReason = (reason: unknown) => {
      if (!reason || typeof reason !== 'object') return false;
      const r = reason as { name?: string; message?: string };
      if (r.name === 'ChunkLoadError') return true;
      const m = String(r.message || '');
      return m.includes('ChunkLoadError') || /loading chunk \d+ failed/i.test(m);
    };
    const isChunkFailureMessage = (msg: string) =>
      msg.includes('ChunkLoadError') || /loading chunk \d+ failed/i.test(msg);
    const tryReload = () => {
      if (sessionStorage.getItem(storageKey)) return;
      sessionStorage.setItem(storageKey, '1');
      window.location.reload();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (!isChunkFailureReason(e.reason)) return;
      tryReload();
    };
    const onError = (e: ErrorEvent) => {
      if (isChunkFailureReason(e.error) || isChunkFailureMessage(String(e.message || ''))) {
        tryReload();
      }
    };
    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('error', onError);
    return () => {
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('error', onError);
    };
  }, []);

  return (
    <>
      {children}
      <CartDrawer />
      <SupportChatWidget />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: isDark ? '#1c1c1e' : '#fff',
            color: isDark ? '#f4f4f5' : '#111',
            borderRadius: '12px',
            border: `1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}`,
            boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
            fontSize: '14px',
          },
        }}
      />
    </>
  );
}
