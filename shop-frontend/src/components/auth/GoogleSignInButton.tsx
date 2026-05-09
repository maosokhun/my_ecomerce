'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import { useLanguageStore } from '@/store/languageStore';
import { t } from '@/lib/i18n';
import toast from 'react-hot-toast';
import axios from 'axios';

const GIS_SCRIPT = 'https://accounts.google.com/gsi/client';

function loadGisScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Google script load failed')), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = GIS_SCRIPT;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Google script load failed'));
    document.body.appendChild(s);
  });
}

type Props = { redirectTo: string };

export function GoogleSignInButton({ redirectTo }: Props) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  const containerRef = useRef<HTMLDivElement>(null);
  const { loginWithGoogle } = useAuthStore();
  const router = useRouter();
  const { language } = useLanguageStore();

  const onCredential = useCallback(
    async (credential: string) => {
      try {
        await loginWithGoogle(credential);
        toast.success(t(language, 'googleLoginSuccess'));
        router.push(redirectTo);
      } catch (error: unknown) {
        const msg = axios.isAxiosError(error)
          ? (error.response?.data as { message?: string } | undefined)?.message
          : undefined;
        toast.error(msg || t(language, 'googleLoginFailed'));
      }
    },
    [language, loginWithGoogle, redirectTo, router]
  );

  useEffect(() => {
    if (!clientId || !containerRef.current) return;

    let cancelled = false;

    const run = async () => {
      try {
        await loadGisScript();
        if (cancelled || !containerRef.current || !window.google?.accounts?.id) return;

        containerRef.current.innerHTML = '';
        const btnWidth = Math.min(400, Math.max(260, containerRef.current.offsetWidth || 320));
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (res) => {
            if (res?.credential) void onCredential(res.credential);
          },
        });

        const locale =
          language === 'km' ? 'km' : language === 'zh' ? 'zh_CN' : 'en';

        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width: btnWidth,
          locale,
        });
      } catch {
        if (!cancelled) toast.error(t(language, 'googleLoginFailed'));
      }
    };

    void run();

    return () => {
      cancelled = true;
      try {
        window.google?.accounts?.id?.cancel();
      } catch {
        /* ignore */
      }
    };
  }, [clientId, language, onCredential]);

  if (!clientId) return null;

  return <div ref={containerRef} className="w-full flex justify-center [&>div]:!w-full" />;
}
