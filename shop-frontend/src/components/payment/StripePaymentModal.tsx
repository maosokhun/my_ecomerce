'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { CreditCard, X, Loader2, AlertCircle } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

type Lang = 'km' | 'en' | 'zh';

interface StripePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (paymentIntentId: string) => Promise<void>;
  clientSecret: string;
  returnUrl: string;
  publishableKey: string;
  amount: number;
  language: Lang;
}

const labels: Record<
  Lang,
  { title: string; pay: string; processing: string; secure: string; close: string }
> = {
  km: {
    title: 'បង់តាម Stripe',
    pay: 'បង់ប្រាក់',
    processing: 'កំពុងដំណើរការ...',
    secure: 'ទូទាត់តាម Stripe (កាត / Apple Pay តាមឧបករណ៍)',
    close: 'បិទ',
  },
  en: {
    title: 'Pay with Stripe',
    pay: 'Pay now',
    processing: 'Processing…',
    secure: 'Secured by Stripe (cards / wallets where available)',
    close: 'Close',
  },
  zh: {
    title: 'Stripe 支付',
    pay: '立即支付',
    processing: '处理中…',
    secure: '由 Stripe 安全处理（银行卡 / 钱包等）',
    close: '关闭',
  },
};

function CheckoutForm({
  returnUrl,
  amount,
  language,
  onSuccess,
  onClose,
  setError,
}: {
  returnUrl: string;
  amount: number;
  language: Lang;
  onSuccess: (paymentIntentId: string) => Promise<void>;
  onClose: () => void;
  setError: (msg: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const text = labels[language] || labels.en;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError('');
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: 'if_required',
    });
    if (error) {
      setError(error.message || 'Payment failed');
      setBusy(false);
      return;
    }
    if (paymentIntent?.status === 'succeeded' && paymentIntent.id) {
      try {
        await onSuccess(paymentIntent.id);
      } catch {
        setError('Could not confirm payment with the server.');
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
        <p className="text-sm text-gray-500 mb-1">{language === 'zh' ? '金额' : language === 'km' ? 'ចំនួនទឹកប្រាក់' : 'Amount'}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatPrice(amount, language)}</p>
      </div>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-950">
        <PaymentElement />
      </div>
      <button
        type="submit"
        disabled={!stripe || busy}
        className="w-full py-3.5 bg-gray-900 hover:bg-black dark:bg-primary-600 dark:hover:bg-primary-700 disabled:opacity-50 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
      >
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
        {busy ? text.processing : text.pay}
      </button>
      <p className="text-center text-xs text-gray-500">{text.secure}</p>
    </form>
  );
}

export function StripePaymentModal({
  isOpen,
  onClose,
  onSuccess,
  clientSecret,
  returnUrl,
  publishableKey,
  amount,
  language,
}: StripePaymentModalProps) {
  const [error, setError] = useState('');
  const text = labels[language] || labels.en;
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800"
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{text.title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label={text.close}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">
          {!publishableKey ? (
            <p className="text-sm text-red-600">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set.</p>
          ) : (
            <Elements
              stripe={stripePromise}
              options={{ clientSecret, locale: language === 'zh' ? 'zh' : 'en' }}
            >
              {error ? (
                <div className="flex items-start gap-2 text-sm text-red-600 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg mb-4">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              ) : null}
              <CheckoutForm
                returnUrl={returnUrl}
                amount={amount}
                language={language}
                onSuccess={onSuccess}
                onClose={onClose}
                setError={setError}
              />
            </Elements>
          )}
        </div>
      </motion.div>
    </div>
  );
}
