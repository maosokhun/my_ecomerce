import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, X, CheckCircle, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

interface CardPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  amount: number;
  language: 'km' | 'en' | 'zh';
}

export function CardPaymentModal({ isOpen, onClose, onSuccess, amount, language }: CardPaymentModalProps) {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const t = {
    km: {
      title: 'ការទូទាត់តាមកាត',
      amount: 'ចំនួនទឹកប្រាក់',
      cardNumber: 'លេខកាត',
      expiry: 'ថ្ងៃផុតកំណត់',
      cvc: 'លេខកូដ CVC',
      name: 'ឈ្មោះនៅលើកាត',
      payNow: 'បង់ប្រាក់ឥឡូវនេះ',
      processing: 'កំពុងដំណើរការ...',
      success: 'ការទូទាត់ទទួលបានជោគជ័យ!',
      error: 'សូមបញ្ចូលព័ត៌មានកាតអោយបានត្រឹមត្រូវ',
      secure: 'ការទូទាត់មានសុវត្ថិភាព 100%'
    },
    en: {
      title: 'Card Payment',
      amount: 'Amount to Pay',
      cardNumber: 'Card Number',
      expiry: 'Expiry Date',
      cvc: 'CVC',
      name: 'Name on Card',
      payNow: 'Pay Now',
      processing: 'Processing Payment...',
      success: 'Payment Successful!',
      error: 'Please enter valid card details',
      secure: '100% Secure Payment'
    },
    zh: {
      title: '银行卡支付',
      amount: '支付金额',
      cardNumber: '卡号',
      expiry: '有效期',
      cvc: '安全码 (CVC)',
      name: '持卡人姓名',
      payNow: '立即支付',
      processing: '支付处理中...',
      success: '支付成功！',
      error: '请输入有效的银行卡信息',
      secure: '100% 支付安全保障'
    }
  };

  const text = t[language] || t.en;

  // Format card number with spaces
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    let formattedValue = '';
    for (let i = 0; i < value.length; i++) {
      if (i > 0 && i % 4 === 0) formattedValue += ' ';
      formattedValue += value[i];
    }
    setCardNumber(formattedValue.substring(0, 19));
  };

  // Format expiry (MM/YY)
  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length >= 2) {
      value = value.substring(0, 2) + '/' + value.substring(2, 4);
    }
    setExpiry(value.substring(0, 5));
  };

  useEffect(() => {
    if (!isOpen) {
      // Reset state when closed
      setTimeout(() => {
        setCardNumber('');
        setExpiry('');
        setCvc('');
        setName('');
        setIsProcessing(false);
        setIsSuccess(false);
        setError('');
      }, 300);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (cardNumber.length < 15 || expiry.length < 5 || cvc.length < 3 || !name.trim()) {
      setError(text.error);
      return;
    }

    setIsProcessing(true);

    // Simulate network delay for realistic feel
    try {
      await new Promise(resolve => setTimeout(resolve, 2500));
      setIsSuccess(true);
      await new Promise(resolve => setTimeout(resolve, 1500));
      await onSuccess();
    } catch {
      setError('Payment failed. Please try again.');
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={!isProcessing && !isSuccess ? onClose : undefined}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-primary-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{text.title}</h2>
          </div>
          {!isProcessing && !isSuccess && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {!isProcessing && !isSuccess ? (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleSubmit}
                className="space-y-6"
              >
                {/* Amount Display */}
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                  <p className="text-sm text-gray-500 mb-1">{text.amount}</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {formatPrice(amount, language)}
                  </p>
                </div>

                {/* Simulated Card Display */}
                <div className="relative h-48 rounded-2xl p-6 text-white overflow-hidden shadow-lg"
                     style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #312e81 100%)' }}>
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-400/20 rounded-full blur-2xl flex items-center justify-center" />
                  
                  <div className="relative h-full flex flex-col justify-between z-10">
                    <div className="flex justify-between items-center">
                      <div className="w-12 h-8 bg-white/20 rounded border border-white/30" />
                      <div className="flex gap-1">
                        <div className="w-8 h-8 rounded-full bg-red-500/80 mix-blend-multiply" />
                        <div className="w-8 h-8 rounded-full bg-yellow-500/80 mix-blend-multiply -ml-4" />
                      </div>
                    </div>
                    <div>
                      <p className="font-mono text-xl tracking-widest text-white/90 mb-2">
                        {cardNumber || '•••• •••• •••• ••••'}
                      </p>
                      <div className="flex justify-between items-end text-sm">
                        <div className="max-w-[70%]">
                          <p className="text-white/60 text-xs mb-0.5">Card Holder</p>
                          <p className="font-medium truncate uppercase tracking-widest text-white/90">
                            {name || 'YOUR NAME'}
                          </p>
                        </div>
                        <div>
                          <p className="text-white/60 text-xs mb-0.5 text-right">Expires</p>
                          <p className="font-mono text-white/90">
                            {expiry || 'MM/YY'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                  <div>
                    <input
                      type="text"
                      placeholder={text.cardNumber}
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-600 focus:border-transparent transition-all outline-none font-mono"
                      maxLength={19}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder={text.expiry}
                      value={expiry}
                      onChange={handleExpiryChange}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-600 focus:border-transparent transition-all outline-none font-mono"
                      maxLength={5}
                    />
                    <input
                      type="text"
                      placeholder={text.cvc}
                      value={cvc}
                      onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').substring(0, 4))}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-600 focus:border-transparent transition-all outline-none font-mono"
                      maxLength={4}
                    />
                  </div>

                  <div>
                    <input
                      type="text"
                      placeholder={text.name}
                      value={name}
                      onChange={(e) => setName(e.target.value.toUpperCase())}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-600 focus:border-transparent transition-all outline-none uppercase"
                    />
                  </div>
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="flex items-center gap-2 text-sm text-red-600 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg"
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <p>{error}</p>
                  </motion.div>
                )}

                <button
                  type="submit"
                  className="w-full py-4 bg-gray-900 hover:bg-black dark:bg-primary-600 dark:hover:bg-primary-700 text-white rounded-xl font-bold transition-all active:scale-[0.98] shadow-lg shadow-black/10 dark:shadow-primary-900/30 flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-5 h-5" />
                  {text.payNow}
                </button>

                <p className="text-center text-xs text-gray-500 flex items-center justify-center gap-1.5 mt-4">
                  <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                  {text.secure}
                </p>
              </motion.form>
            ) : isSuccess ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-12 flex flex-col items-center justify-center text-center space-y-4"
              >
                <div className="w-24 h-24 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
                  >
                    <CheckCircle className="w-12 h-12 text-green-600" />
                  </motion.div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {text.success}
                </h3>
                <p className="text-gray-500">
                  {formatPrice(amount, language)}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="processing"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="py-16 flex flex-col items-center justify-center text-center space-y-6"
              >
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <Loader2 className="w-12 h-12 text-primary-600 animate-spin absolute" />
                  <CreditCard className="w-6 h-6 text-primary-700 animate-pulse relative z-10" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    {text.processing}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Connecting to secure payment gateway...
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
