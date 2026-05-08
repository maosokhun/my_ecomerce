'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Eye, EyeOff, UserPlus, CheckCircle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useLanguageStore } from '@/store/languageStore';
import { t } from '@/lib/i18n';
import toast from 'react-hot-toast';
import axios from 'axios';

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const { register, isLoading } = useAuthStore();
  const { language } = useLanguageStore();
  const router = useRouter();

  const passwordStrength = (password: string) => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };

  const strength = passwordStrength(form.password);
  const strengthLabels = ['', t(language, 'passwordWeak'), t(language, 'passwordFair'), t(language, 'passwordGood'), t(language, 'passwordStrong')];
  const strengthColors = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[\p{L}\p{M}\s'.-]+$/u.test(form.name.trim())) {
      toast.error(t(language, 'invalidNameLettersOnly'));
      return;
    }
    if (form.email.trim() && !EMAIL_FORMAT.test(form.email.trim())) {
      toast.error(t(language, 'invalidEmailFormat'));
      return;
    }
    const phoneDigits = form.phone.replace(/\D/g, '');
    if (!/^\d{8,15}$/.test(phoneDigits)) {
      toast.error(t(language, 'invalidPhoneDigitsOnly'));
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error(t(language, 'passwordsDoNotMatch'));
      return;
    }
    const hasLower = /[a-z]/.test(form.password);
    const hasUpper = /[A-Z]/.test(form.password);
    const hasNumber = /\d/.test(form.password);
    const hasSpecial = /[^A-Za-z0-9]/.test(form.password);
    if (form.password.length < 8 || !hasLower || !hasUpper || !hasNumber || !hasSpecial) {
      toast.error(t(language, 'passwordRuleError'));
      return;
    }
    try {
      await register(form.name.trim(), form.email.trim() || undefined, phoneDigits, form.password);
      toast.success(t(language, 'accountCreatedWelcome'));
      router.push('/');
    } catch (error: unknown) {
      const msg = axios.isAxiosError(error)
        ? (error.response?.data as { message?: string } | undefined)?.message
        : undefined;
      toast.error(msg || t(language, 'registrationFailed'));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md"
    >
      <div className="card p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t(language, 'createAccount')}</h1>
          <p className="text-gray-500 mt-1 text-sm">{t(language, 'joinShopText')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t(language, 'fullName')}</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="John Doe"
              required
              className="input"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t(language, 'emailAddress')}</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder={language === 'km' ? 'you@example.com (ស្រេចចិត្ត)' : language === 'zh' ? 'you@example.com（可选）' : 'you@example.com (optional)'}
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t(language, 'phoneNumber')}</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value.replace(/\D/g, '') }))}
              placeholder="012345678"
              required
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t(language, 'password')}</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                placeholder={t(language, 'min8Chars')}
                required
                className="input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {form.password && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all ${i <= strength ? strengthColors[strength] : 'bg-gray-200 dark:bg-gray-700'}`}
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-500">{strengthLabels[strength]}</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t(language, 'confirmPassword')}</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                placeholder={t(language, 'repeatPassword')}
                required
                className="input pr-10"
              />
              {form.confirmPassword && form.password === form.confirmPassword && (
                <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
              )}
            </div>
          </div>

          <button type="submit" disabled={isLoading} className="btn-primary w-full py-3">
            <UserPlus className="w-4 h-4" />
            {isLoading ? t(language, 'creatingAccount') : t(language, 'createAccount')}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-4">
          {t(language, 'byRegisteringAgree')}{' '}
          <Link href="#" className="text-primary-600 hover:underline">{t(language, 'terms')}</Link> {t(language, 'and')}{' '}
          <Link href="#" className="text-primary-600 hover:underline">{t(language, 'privacyPolicy')}</Link>
        </p>

        <p className="text-center text-sm text-gray-500 mt-4">
          {t(language, 'alreadyHaveAccount')}{' '}
          <Link href="/login" className="text-primary-600 font-semibold hover:underline">{t(language, 'signIn')}</Link>
        </p>
      </div>
    </motion.div>
  );
}
