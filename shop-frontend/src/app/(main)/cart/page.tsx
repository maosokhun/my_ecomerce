'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ShoppingBag, Minus, Plus, Trash2, ArrowRight, Tag } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { formatPrice } from '@/lib/utils';
import { useLanguageStore } from '@/store/languageStore';
import { t } from '@/lib/i18n';
import toast from 'react-hot-toast';
import { orderApi } from '@/lib/api';

export default function CartPage() {
  const { cart, fetchCart, updateItem, removeItem, isLoading } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const { language } = useLanguageStore();
  const router = useRouter();
  const [couponInput, setCouponInput] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  useEffect(() => {
    fetchCart();
  }, [isAuthenticated, fetchCart]);

  const subtotal = cart?.cartTotal || 0;
  const shipping = subtotal >= 50 ? 0 : 9.99;
  const total = subtotal + shipping;

  const applyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;
    setIsApplyingCoupon(true);
    try {
      await orderApi.previewCoupon({ couponCode: code });
      localStorage.setItem('couponCode', code.toUpperCase());
      toast.success(language === 'km' ? 'បានរក្សាទុក Coupon' : language === 'zh' ? '优惠券已保存' : 'Coupon saved');
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || t(language, 'invalidCouponCode'));
      localStorage.removeItem('couponCode');
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  return (
    <div className="page-container py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        {t(language, 'shoppingCart')} ({cart?.itemCount || 0} {t(language, 'items')})
      </h1>

      {!cart || cart.items.length === 0 ? (
        <div className="text-center py-20">
          <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">{t(language, 'yourCartIsEmpty')}</h2>
          <p className="text-gray-500 mb-6">{t(language, 'cartEmptyLong')}</p>
          <Link href="/products" className="btn-primary">{t(language, 'startShopping')}</Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Cart items */}
          <div className="lg:col-span-2 space-y-4">
            {cart.items.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card p-4 flex gap-4"
              >
                <Link href={`/products/${item.product.slug}`} className="relative w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden bg-gray-50">
                  {item.product.thumbnail ? (
                    <Image src={item.product.thumbnail} alt={item.product.name} fill className="object-cover" sizes="96px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="w-8 h-8 text-gray-300" /></div>
                  )}
                </Link>

                <div className="flex-1 min-w-0">
                  <Link href={`/products/${item.product.slug}`} className="font-semibold text-gray-900 dark:text-white hover:text-primary-600 text-sm line-clamp-2">
                    {item.product.name}
                  </Link>
                  <p className="text-base font-bold text-primary-600 mt-1">{formatPrice(item.product.price)}</p>

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      <button
                        onClick={async () => {
                          if (item.quantity <= 1) { await removeItem(item.id); return; }
                          await updateItem(item.id, item.quantity - 1);
                        }}
                        disabled={isLoading}
                        className="w-8 h-8 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-surface-800 transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-10 text-center text-sm font-semibold">{item.quantity}</span>
                      <button
                        onClick={() => updateItem(item.id, item.quantity + 1)}
                        disabled={isLoading || item.quantity >= item.product.stock}
                        className="w-8 h-8 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-surface-800 transition-colors disabled:opacity-40"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-900 dark:text-white">
                        {formatPrice(item.product.price * item.quantity)}
                      </span>
                      <button
                        onClick={async () => {
                          await removeItem(item.id);
                          toast.success(t(language, 'itemRemoved'));
                        }}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Order summary */}
          <div className="space-y-4">
            <div className="card p-5">
              <h2 className="font-bold text-gray-900 dark:text-white mb-4">{t(language, 'orderSummary')}</h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>{t(language, 'subtotal')} ({cart.itemCount} {t(language, 'items')})</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>{t(language, 'shipping')}</span>
                  <span className={shipping === 0 ? 'text-green-600' : ''}>{shipping === 0 ? t(language, 'freeUpper') : formatPrice(shipping)}</span>
                </div>
                <div className="border-t border-gray-100 dark:border-gray-800 pt-3 flex justify-between text-base font-bold text-gray-900 dark:text-white">
                  <span>{t(language, 'total')}</span>
                  <span>{formatPrice(total)}</span>
                </div>
              </div>

              {subtotal < 50 && (
                <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-xs text-green-700 dark:text-green-400">
                  {t(language, 'addMoreForFreeShipping').replace('{amount}', formatPrice(50 - subtotal))}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  if (!isAuthenticated) {
                    toast.error(t(language, 'signInToContinue'));
                    router.push('/login?redirect=/checkout');
                    return;
                  }
                  router.push('/checkout');
                }}
                className="btn-primary w-full mt-5"
              >
                {t(language, 'checkout')} <ArrowRight className="w-4 h-4" />
              </button>
              <Link href="/products" className="btn-secondary w-full mt-2 text-sm">
                {t(language, 'continueShopping')}
              </Link>
            </div>

            {/* Coupon */}
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Tag className="w-4 h-4" /> {t(language, 'couponCode')}
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="WELCOME20"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  className="input text-sm flex-1"
                />
                <button onClick={applyCoupon} disabled={isApplyingCoupon} className="btn-secondary text-sm px-4">
                  {isApplyingCoupon ? '...' : t(language, 'apply')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
