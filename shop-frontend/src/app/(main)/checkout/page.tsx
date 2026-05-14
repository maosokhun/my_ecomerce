'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { CheckCircle, ChevronRight, ShoppingBag, CreditCard, MapPin, Package, QrCode } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { useLanguageStore } from '@/store/languageStore';
import { userApi, orderApi, paymentApi, locationApi, settingApi } from '@/lib/api';
import { t } from '@/lib/i18n';
import { formatPrice } from '@/lib/utils';
import { Address } from '@/types';
import toast from 'react-hot-toast';
import axios from 'axios';
import { EmptyState } from '@/components/common/EmptyState';
import { CardPaymentModal } from '@/components/payment/CardPaymentModal';
import { StripePaymentModal } from '@/components/payment/StripePaymentModal';

export default function CheckoutPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [addingAddress, setAddingAddress] = useState(false);
  const [shippingFees, setShippingFees] = useState<{ legacy: number; vet: number; jnt: number }>({
    legacy: 2.0,
    vet: 2.0,
    jnt: 2.0,
  });
  const [shippingCarrier, setShippingCarrier] = useState<'VET' | 'JNT'>('VET');
  type LocRow = {
    id: string;
    code?: string | null;
    nameKm: string;
    nameEn?: string | null;
    nameZh?: string | null;
    name?: string;
    locKey?: string;
  };
  const [provinces, setProvinces] = useState<LocRow[]>([]);
  const [districts, setDistricts] = useState<LocRow[]>([]);
  const [communes, setCommunes] = useState<LocRow[]>([]);
  const [villages, setVillages] = useState<LocRow[]>([]);
  const [newAddress, setNewAddress] = useState({
    provinceId: '', districtId: '', communeId: '', villageId: '',
    name: '', phone: '', province: '', district: '', commune: '', village: '', roadNumber: '',
    note: '', isDefault: false,
  });
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'bakong'>('card');
  const [couponInput, setCouponInput] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponError, setCouponError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<{ id: string; orderNumber: string; total: number } | null>(null);
  const [khqrPayment, setKhqrPayment] = useState<{
    orderId: string;
    reference: string;
    qrImageUrl: string;
    expiresAt: string;
    amount: number;
  } | null>(null);
  const [cardPaymentOrder, setCardPaymentOrder] = useState<{
    id: string;
    amount: number;
    orderNumber: string;
    clientSecret: string | null;
  } | null>(null);

  const { cart, fetchCart } = useCartStore();
  const { isAuthenticated, user, isAuthChecked } = useAuthStore();
  const { language } = useLanguageStore();
  const steps = [t(language, 'address'), t(language, 'review'), t(language, 'payment'), t(language, 'confirmation')];
  const checkoutText = useMemo(() => ({
    addPhoneBeforeCheckout: language === 'zh' ? '请先在个人资料中添加电话号码再结账' : language === 'en' ? 'Please add your phone number in profile before checkout' : 'សូមបន្ថែមលេខទូរស័ព្ទក្នុងប្រវត្តិរូបមុនពេលទូទាត់',
    addressAdded: language === 'zh' ? '地址已添加' : language === 'en' ? 'Address added' : 'បានបន្ថែមអាសយដ្ឋាន',
    addAddressFailed: language === 'zh' ? '添加地址失败' : language === 'en' ? 'Failed to add address' : 'បន្ថែមអាសយដ្ឋានបរាជ័យ',
    signInFirst: language === 'zh' ? '请先登录' : language === 'en' ? 'Please sign in first' : 'សូមចូលគណនីជាមុន',
    addPhoneBeforePayment: language === 'zh' ? '请先在个人资料中添加电话号码再支付' : language === 'en' ? 'Please add phone number in profile before payment' : 'សូមបន្ថែមលេខទូរស័ព្ទក្នុងប្រវត្តិរូបមុនពេលបង់ប្រាក់',
    selectAddress: language === 'zh' ? '请选择地址' : language === 'en' ? 'Please select an address' : 'សូមជ្រើសរើសអាសយដ្ឋាន',
    addCompleteAddress: language === 'zh' ? '请先填写完整收货地址再支付' : language === 'en' ? 'Please add complete delivery address before payment' : 'សូមបញ្ចូលអាសយដ្ឋានដឹកជញ្ជូនឱ្យពេញលេញមុនពេលបង់ប្រាក់',
    completeAddressFields: language === 'zh' ? '请完善完整收货地址（省/市、区/县、乡/分区、村、路号和电话）' : language === 'en' ? 'Please complete full delivery address (province, district, commune, village, road and phone)' : 'សូមបំពេញអាសយដ្ឋានដឹកជញ្ជូនឱ្យពេញលេញ (ខេត្ត/រាជធានី, ស្រុក/ខណ្ឌ, ឃុំ/សង្កាត់, ភូមិ, ផ្លូវលេខ និងលេខទូរស័ព្ទ)',
  }), [language]);

  const uiText = {
    province: language === 'zh' ? '选择省/直辖市' : language === 'en' ? 'Select Province' : 'ជ្រើសរើសខេត្ត/រាជធានី',
    district: language === 'zh' ? '选择区/县' : language === 'en' ? 'Select District' : 'ជ្រើសរើសស្រុក/ខណ្ឌ',
    commune: language === 'zh' ? '选择乡/分区' : language === 'en' ? 'Select Commune' : 'ជ្រើសរើសឃុំ/សង្កាត់',
    village: language === 'zh' ? '选择村' : language === 'en' ? 'Select Village' : 'ជ្រើសរើសភូមិ',
    noDistrict: language === 'zh' ? '该省暂无区/县数据' : language === 'en' ? 'No district data' : 'មិនមានទិន្នន័យស្រុក/ខណ្ឌ',
    noCommune: language === 'zh' ? '该区/县暂无乡/分区数据' : language === 'en' ? 'No commune data' : 'មិនមានទិន្នន័យឃុំ/សង្កាត់',
    noVillage: language === 'zh' ? '该乡/分区暂无村数据' : language === 'en' ? 'No village data' : 'មិនមានទិន្នន័យភូមិ',
  };

  const locKeyOf = (row: LocRow) => {
    if (row.locKey != null && row.locKey !== '') return row.locKey;
    const code = row.code?.trim();
    return code ? code : row.id;
  };

  const locLabel = (row: LocRow) => {
    if (row.name) return row.name;
    if (language === 'zh' && row.nameZh) return row.nameZh;
    if (language === 'en' && row.nameEn) return row.nameEn;
    return row.nameKm;
  };

  useEffect(() => {
    if (!isAuthChecked) return;
    if (!isAuthenticated) { router.push('/login?redirect=/checkout'); return; }
    if (!user?.phone) {
      toast.error(checkoutText.addPhoneBeforeCheckout);
      router.push('/dashboard');
      return;
    }
    fetchCart();
    userApi.getAddresses()
      .then(({ data }) => {
        const list: Address[] = data.data || [];
        setAddresses(list);
        const defaultAddr = list.find((a: Address) => a.isDefault);
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr.id);
          return;
        }
        // Auto-select first address to avoid checkout blocking when no default exists.
        if (list.length > 0) setSelectedAddressId(list[0].id);
      })
      .catch(() => {
        toast.error(language === 'zh' ? '加载地址失败' : language === 'en' ? 'Failed to load addresses' : 'ទាញយកអាសយដ្ឋានបរាជ័យ');
      });
  }, [isAuthChecked, isAuthenticated, user?.phone, router, fetchCart, checkoutText.addPhoneBeforeCheckout, language]);

  useEffect(() => {
    locationApi.getProvinces(language).then(({ data }) => setProvinces(data.data || [])).catch(() => {});
    settingApi.get().then(({ data }) => {
      const d = data.data as { shippingFee?: number; shippingFeeVet?: number; shippingFeeJnt?: number } | undefined;
      const legacy = d?.shippingFee ?? 2.0;
      setShippingFees({
        legacy,
        vet: d?.shippingFeeVet ?? legacy,
        jnt: d?.shippingFeeJnt ?? legacy,
      });
    }).catch(() => {});
  }, [language]);

  useEffect(() => {
    if (!newAddress.provinceId) {
      setDistricts([]);
      return;
    }
    locationApi.getDistricts(newAddress.provinceId, language).then(({ data }) => setDistricts(data.data || [])).catch(() => setDistricts([]));
  }, [newAddress.provinceId, language]);

  useEffect(() => {
    if (!newAddress.districtId) {
      setCommunes([]);
      return;
    }
    locationApi
      .getCommunes(newAddress.districtId, language, newAddress.provinceId)
      .then(({ data }) => setCommunes(data.data || []))
      .catch(() => setCommunes([]));
  }, [newAddress.districtId, newAddress.provinceId, language]);

  useEffect(() => {
    if (!newAddress.communeId) {
      setVillages([]);
      return;
    }
    locationApi
      .getVillages(newAddress.communeId, language, {
        districtId: newAddress.districtId,
        provinceId: newAddress.provinceId,
      })
      .then(({ data }) => setVillages(data.data || []))
      .catch(() => setVillages([]));
  }, [newAddress.communeId, newAddress.districtId, newAddress.provinceId, language]);

  const subtotal = cart?.cartTotal || 0;
  const shipping = shippingCarrier === 'JNT' ? shippingFees.jnt : shippingFees.vet;
  const discount = appliedCoupon?.discount || 0;
  const total = Math.max(0, subtotal + shipping - discount);

  const carrierLabels = useMemo(
    () => ({
      section:
        language === 'zh' ? '快递公司' : language === 'en' ? 'Delivery company' : 'ក្រុមហ៊ុនដឹកជញ្ជូន',
      vetTitle: 'VET',
      jntTitle: 'J&T',
      vetHint:
        language === 'zh'
          ? '选择 VET 配送'
          : language === 'en'
            ? 'Ship with VET Express'
            : 'ដឹកជញ្ជូនតាម VET',
      jntHint:
        language === 'zh'
          ? '选择 J&T 配送'
          : language === 'en'
            ? 'Ship with J&T Express'
            : 'ដឹកជញ្ជូនតាម J&T',
    }),
    [language]
  );

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await userApi.addAddress({ ...newAddress, lang: language });
      setAddresses((prev) => [...prev, data.data]);
      setSelectedAddressId(data.data.id);
      setAddingAddress(false);
      toast.success(checkoutText.addressAdded);
    } catch (error: unknown) {
      const msg = axios.isAxiosError(error)
        ? (error.response?.data as { message?: string } | undefined)?.message
        : undefined;
      toast.error(msg || checkoutText.addAddressFailed);
    }
  };

  const handlePlaceOrder = async () => {
    if (!isAuthenticated) {
      toast.error(checkoutText.signInFirst);
      router.push('/login?redirect=/checkout');
      return;
    }
    if (!user?.phone) {
      toast.error(checkoutText.addPhoneBeforePayment);
      router.push('/dashboard');
      return;
    }
    if (!selectedAddressId && addresses.length > 0) {
      toast.error(checkoutText.selectAddress);
      return;
    }
    if (addresses.length === 0) {
      toast.error(checkoutText.addCompleteAddress);
      setStep(0);
      return;
    }
    const selectedAddress = addresses.find((a) => a.id === selectedAddressId);
    if (
      !selectedAddress?.province ||
      !selectedAddress?.district ||
      !selectedAddress?.commune ||
      !selectedAddress?.village ||
      !selectedAddress?.roadNumber ||
      !selectedAddress?.phone
    ) {
      toast.error(checkoutText.completeAddressFields);
      setStep(0);
      return;
    }
    setIsProcessing(true);
    try {
      const normalizedCoupon = appliedCoupon?.code || '';
      const { data } = await orderApi.create({
        addressId: selectedAddressId || undefined,
        paymentMethod,
        notes,
        shippingCarrier,
        couponCode: normalizedCoupon || undefined,
      });
      const orderId = data.data.order.id as string;

      if (paymentMethod === 'bakong') {
        const khqrRes = await paymentApi.createKhqr(orderId);
        setKhqrPayment({
          orderId,
          reference: khqrRes.data.data.reference,
          qrImageUrl: khqrRes.data.data.qrImageUrl,
          expiresAt: khqrRes.data.data.expiresAt,
          amount: khqrRes.data.data.amount,
        });
        toast.success('KHQR generated. Please scan to pay.');
      } else {
        const stripeUnavailable = Boolean((data.data as { stripeUnavailable?: boolean }).stripeUnavailable);
        if (stripeUnavailable) {
          toast.error(
            language === 'zh'
              ? '无法初始化银行卡支付，请到订单页重试或联系客服。'
              : language === 'km'
                ? 'មិនអាចចាប់ផ្តើមការទូទាត់កាតបានទេ។ សូមទៅកម្មង់របស់អ្នកដើម្បីព្យាយាមម្តងទៀត។'
                : 'Card payment could not start. Open your order to try again or contact support.'
          );
          router.push(`/dashboard/orders/${orderId}`);
          return;
        }
        const clientSecret = (data.data as { clientSecret?: string | null }).clientSecret ?? null;
        setCardPaymentOrder({
          id: orderId,
          amount: data.data.order.total,
          orderNumber: data.data.order.orderNumber,
          clientSecret,
        });
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(
        err.response?.data?.message ||
        (language === 'zh' ? '创建订单失败' : language === 'en' ? 'Order failed' : 'ការបញ្ជាទិញបរាជ័យ')
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;
    setIsApplyingCoupon(true);
    setCouponError('');
    try {
      const { data } = await orderApi.previewCoupon({ couponCode: code, shippingCarrier });
      const preview = data.data as { couponCode?: string; discount?: number };
      setCouponInput((preview.couponCode || code).toUpperCase());
      setAppliedCoupon({
        code: (preview.couponCode || code).toUpperCase(),
        discount: Number(preview.discount || 0),
      });
      toast.success(language === 'km' ? 'បានអនុវត្ត Coupon' : language === 'zh' ? '优惠券已应用' : 'Coupon applied');
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      const errorText = msg || t(language, 'invalidCouponCode');
      setCouponError(errorText);
      setAppliedCoupon(null);
      toast.error(errorText);
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleClearCoupon = () => {
    setCouponInput('');
    setCouponError('');
    setAppliedCoupon(null);
  };

  useEffect(() => {
    if (!appliedCoupon?.code) return;
    orderApi
      .previewCoupon({ couponCode: appliedCoupon.code, shippingCarrier })
      .then(({ data }) => {
        const preview = data.data as { couponCode?: string; discount?: number };
        setAppliedCoupon({
          code: (preview.couponCode || appliedCoupon.code).toUpperCase(),
          discount: Number(preview.discount || 0),
        });
      })
      .catch(() => {
        setAppliedCoupon(null);
      });
  }, [shippingCarrier, appliedCoupon?.code]);

  const stripePublishableKey = (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '').trim();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('stripe_return') !== '1') return;
    const orderId = params.get('order_id');
    const redirectStatus = params.get('redirect_status');
    const pi = params.get('payment_intent');
    if (!orderId || !pi || redirectStatus !== 'succeeded') return;

    let cancelled = false;
    (async () => {
      try {
        await orderApi.confirmPayment({ orderId, paymentIntentId: pi });
        const { data } = await orderApi.getById(orderId);
        if (cancelled) return;
        const o = data.data as { id: string; orderNumber: string; total: number };
        setCompletedOrder({ id: o.id, orderNumber: o.orderNumber, total: o.total });
        setStep(3);
        await fetchCart();
        toast.success(
          language === 'zh' ? '支付已确认' : language === 'km' ? 'ការទូទាត់បានបញ្ជាក់' : 'Payment confirmed'
        );
        router.replace('/checkout');
      } catch {
        if (!cancelled) {
          toast.error(
            language === 'zh' ? '确认支付失败' : language === 'km' ? 'បញ្ជាក់ការទូទាត់បរាជ័យ' : 'Could not confirm payment after redirect'
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, fetchCart, language]);

  const handleCardPaymentSuccess = async (paymentIntentId: string = 'mock_card_payment') => {
    if (!cardPaymentOrder) return;
    try {
      await orderApi.confirmPayment({ orderId: cardPaymentOrder.id, paymentIntentId });
      setCompletedOrder({
        id: cardPaymentOrder.id,
        orderNumber: cardPaymentOrder.orderNumber,
        total: cardPaymentOrder.amount,
      });
      setStep(3);
      await fetchCart();
      setCardPaymentOrder(null);
    } catch {
      toast.error('Could not confirm payment server-side.');
      router.push(`/dashboard/orders/${cardPaymentOrder.id}`);
    }
  };

  const handleCardModalClose = () => {
    if (cardPaymentOrder) {
      toast('Payment cancelled. You can complete it later in your orders.', { icon: 'ℹ️' });
      router.push(`/dashboard/orders/${cardPaymentOrder.id}`);
    }
    setCardPaymentOrder(null);
  };

  useEffect(() => {
    if (!khqrPayment) return;
    const poll = setInterval(async () => {
      try {
        const { data } = await paymentApi.getKhqrStatus(khqrPayment.orderId);
        if (data.data.paymentStatus === 'PAID') {
          setCompletedOrder({
            id: khqrPayment.orderId,
            orderNumber: data.data.orderNumber,
            total: data.data.total,
          });
          setKhqrPayment(null);
          setStep(3);
          await fetchCart();
          toast.success('KHQR payment confirmed');
        }
      } catch {
        // keep polling silently
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [khqrPayment, fetchCart]);

  if (!isAuthChecked) {
    return (
      <div className="page-container py-16 max-w-5xl">
        <div className="card p-6 animate-pulse">
          <div className="h-6 w-48 bg-gray-200 dark:bg-gray-800 rounded mb-4" />
          <div className="h-4 w-full bg-gray-200 dark:bg-gray-800 rounded mb-2" />
          <div className="h-4 w-5/6 bg-gray-200 dark:bg-gray-800 rounded" />
        </div>
      </div>
    );
  }

  if (!cart && step < 3) {
    return (
      <div className="page-container py-20 text-center min-h-[50vh] flex flex-col items-center justify-center">
        <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">
          {language === 'zh' ? '正在加载购物车...' : language === 'en' ? 'Loading cart...' : 'កំពុងផ្ទុកកន្ត្រក...'}
        </h2>
      </div>
    );
  }

  if (cart && cart.items.length === 0 && step < 3) {
    return (
      <div className="page-container py-20 min-h-[60vh] flex flex-col items-center justify-center">
        <EmptyState
          icon={ShoppingBag}
          title={language === 'zh' ? 'Your cart is empty' : language === 'en' ? 'Your cart is empty' : 'កន្ត្រករបស់អ្នកទទេ'}
          description={language === 'zh' ? 'Add some items to your cart to start checking out.' : language === 'en' ? 'Add some items to your cart to start checking out.' : 'បន្ថែមទំនិញមួយចំនួនទៅក្នុងកន្ត្រករបស់អ្នកដើម្បីចាប់ផ្តើមការទូទាត់។'}
          actionText={t(language, 'browseProducts')}
          actionHref="/products"
        />
      </div>
    );
  }

  return (
    <div className="page-container py-8 max-w-5xl">
      {/* Step indicator */}
      {step < 3 && (
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.slice(0, 3).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                i === step ? 'bg-primary-600 text-white' :
                i < step ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                'bg-gray-100 dark:bg-surface-800 text-gray-500'
              }`}>
                {i < step ? <CheckCircle className="w-4 h-4" /> : <span className="w-5 h-5 rounded-full bg-white/30 flex items-center justify-center text-xs">{i + 1}</span>}
                {s}
              </div>
              {i < 2 && <ChevronRight className="w-4 h-4 text-gray-300" />}
            </div>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {/* Step 0: Address */}
            {step === 0 && (
              <motion.div key="address" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="card p-6">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary-600" /> {t(language, 'deliveryAddress')}
                  </h2>

                  <div className="space-y-3 mb-5">
                    {addresses.map((addr) => (
                      <label key={addr.id} className={`flex gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                        selectedAddressId === addr.id ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/10' : 'border-gray-200 dark:border-gray-700'
                      }`}>
                        <input
                          type="radio"
                          name="address"
                          checked={selectedAddressId === addr.id}
                          onChange={() => setSelectedAddressId(addr.id)}
                          className="mt-0.5"
                        />
                        <div className="text-sm">
                          <p className="font-semibold text-gray-900 dark:text-white">{addr.name} • {addr.phone}</p>
                          <p className="text-gray-500 mt-0.5">
                            {addr.province}, {addr.district}, {addr.commune}, {addr.village}, {t(language, 'roadNumber')} {addr.roadNumber}
                          </p>
                          {addr.note && <p className="text-gray-500 mt-0.5 text-xs italic">Note: {addr.note}</p>}
                          {addr.isDefault && <span className="badge bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 mt-1">{t(language, 'default')}</span>}
                        </div>
                      </label>
                    ))}
                  </div>

                  {!addingAddress ? (
                    <button onClick={() => setAddingAddress(true)} className="btn-secondary text-sm w-full">
                      + {t(language, 'addNewAddress')}
                    </button>
                  ) : (
                    <form onSubmit={handleAddAddress} className="space-y-3 p-4 bg-gray-50 dark:bg-surface-800 rounded-xl">
                      <h3 className="font-semibold text-sm">
                        {language === 'km' ? 'អាសយដ្ឋានថ្មី' : language === 'zh' ? '新地址' : 'New Address'}
                      </h3>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <select
                          required
                          value={newAddress.provinceId}
                          onChange={(e) => {
                            const selected = provinces.find((p) => locKeyOf(p) === e.target.value);
                            setNewAddress((prev) => ({
                              ...prev,
                              provinceId: e.target.value,
                              province: selected?.nameKm || '',
                              districtId: '',
                              district: '',
                              communeId: '',
                              commune: '',
                              villageId: '',
                              village: '',
                            }));
                          }}
                          className="input text-sm"
                        >
                          <option value="" disabled hidden>{uiText.province}</option>
                          {provinces.map((p) => <option key={p.id} value={locKeyOf(p)}>{locLabel(p)}</option>)}
                        </select>
                        <select
                          required
                          value={newAddress.districtId}
                          onChange={(e) => {
                            const selected = districts.find((d) => locKeyOf(d) === e.target.value);
                            setNewAddress((prev) => ({
                              ...prev,
                              districtId: e.target.value,
                              district: selected?.nameKm || '',
                              communeId: '',
                              commune: '',
                              villageId: '',
                              village: '',
                            }));
                          }}
                          className="input text-sm"
                          disabled={!newAddress.provinceId}
                        >
                          <option value="" disabled hidden>{uiText.district}</option>
                          {districts.length === 0 && newAddress.provinceId ? (
                            <option value="" disabled>{uiText.noDistrict}</option>
                          ) : null}
                          {districts.map((d) => <option key={d.id} value={locKeyOf(d)}>{locLabel(d)}</option>)}
                        </select>
                        <select
                          required
                          value={newAddress.communeId}
                          onChange={(e) => {
                            const selected = communes.find((c) => locKeyOf(c) === e.target.value);
                            setNewAddress((prev) => ({
                              ...prev,
                              communeId: e.target.value,
                              commune: selected?.nameKm || '',
                              villageId: '',
                              village: '',
                            }));
                          }}
                          className="input text-sm"
                          disabled={!newAddress.districtId}
                        >
                          <option value="" disabled hidden>{uiText.commune}</option>
                          {communes.length === 0 && newAddress.districtId ? (
                            <option value="" disabled>{uiText.noCommune}</option>
                          ) : null}
                          {communes.map((c) => <option key={c.id} value={locKeyOf(c)}>{locLabel(c)}</option>)}
                        </select>
                        <select
                          required
                          value={newAddress.villageId}
                          onChange={(e) => {
                            const selected = villages.find((v) => locKeyOf(v) === e.target.value);
                            setNewAddress((prev) => ({ ...prev, villageId: e.target.value, village: selected?.nameKm || '' }));
                          }}
                          className="input text-sm"
                          disabled={!newAddress.communeId}
                        >
                          <option value="" disabled hidden>{uiText.village}</option>
                          {villages.length === 0 && newAddress.communeId ? (
                            <option value="" disabled>{uiText.noVillage}</option>
                          ) : null}
                          {villages.map((v) => <option key={v.id} value={locKeyOf(v)}>{locLabel(v)}</option>)}
                        </select>
                        {[
                          { key: 'name', label: 'Full Name', required: true },
                          { key: 'phone', label: 'Phone', required: true },
                          { key: 'roadNumber', label: 'House / Road Number', required: true },
                        ].map(({ key, label, required }) => (
                          <input
                            key={key}
                            required={required}
                            placeholder={label}
                            value={(newAddress as Record<string, unknown>)[key] as string}
                            onChange={(e) => setNewAddress((prev) => ({ ...prev, [key]: e.target.value }))}
                            className="input text-sm"
                          />
                        ))}
                      </div>
                      <div>
                        <textarea
                           value={newAddress.note}
                           onChange={(e) => setNewAddress((prev) => ({ ...prev, note: e.target.value }))}
                           placeholder="Note (Optional Delivery Instructions)"
                           className="input resize-none text-sm h-20"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" className="btn-primary text-sm">
                          {language === 'km' ? 'រក្សាទុកអាសយដ្ឋាន' : language === 'zh' ? '保存地址' : 'Save Address'}
                        </button>
                        <button type="button" onClick={() => setAddingAddress(false)} className="btn-secondary text-sm">
                          {language === 'km' ? 'បោះបង់' : language === 'zh' ? '取消' : 'Cancel'}
                        </button>
                      </div>
                    </form>
                  )}

                  <button
                    onClick={() => setStep(1)}
                    disabled={addresses.length > 0 && !selectedAddressId}
                    className="btn-primary w-full mt-5"
                  >
                    {t(language, 'continueToReview')}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 1: Review */}
            {step === 1 && (
              <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="card p-6">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary-600" /> {language === 'km' ? 'ពិនិត្យការបញ្ជាទិញ' : language === 'zh' ? '确认订单' : 'Review Your Order'}
                  </h2>

                  <div className="mb-6">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{carrierLabels.section}</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setShippingCarrier('VET')}
                        className={`text-left p-4 rounded-xl border-2 transition-all ${
                          shippingCarrier === 'VET'
                            ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-primary-400'
                        }`}
                      >
                        <p className="font-semibold text-sm text-gray-900 dark:text-white">{carrierLabels.vetTitle}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{carrierLabels.vetHint}</p>
                        <p className="text-sm font-semibold text-primary-600 mt-2">{formatPrice(shippingFees.vet)}</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShippingCarrier('JNT')}
                        className={`text-left p-4 rounded-xl border-2 transition-all ${
                          shippingCarrier === 'JNT'
                            ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-primary-400'
                        }`}
                      >
                        <p className="font-semibold text-sm text-gray-900 dark:text-white">{carrierLabels.jntTitle}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{carrierLabels.jntHint}</p>
                        <p className="text-sm font-semibold text-primary-600 mt-2">{formatPrice(shippingFees.jnt)}</p>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 mb-5">
                    {cart?.items.map((item) => (
                      <div key={item.id} className="flex gap-3 items-center p-3 bg-gray-50 dark:bg-surface-800 rounded-xl">
                        <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-white flex-shrink-0">
                          {item.product.thumbnail && (
                            <Image 
                              src={item.product.thumbnail} 
                              alt={item.product.name} 
                              fill 
                              className="object-cover" 
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">{item.product.name}</p>
                          <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                        </div>
                        <p className="font-semibold text-sm text-gray-900 dark:text-white">
                          {formatPrice(item.product.price * item.quantity)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Order Notes (Optional)</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Special instructions for your order..."
                      rows={2}
                      className="input resize-none text-sm"
                    />
                  </div>

                  <div className="flex gap-3 mt-5">
                    <button onClick={() => setStep(0)} className="btn-secondary flex-1">
                      {language === 'km' ? 'ថយក្រោយ' : language === 'zh' ? '返回' : 'Back'}
                    </button>
                    <button onClick={() => setStep(2)} className="btn-primary flex-1">
                      {language === 'km' ? 'បន្តទៅបង់ប្រាក់' : language === 'zh' ? '继续付款' : 'Continue to Payment'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: Payment */}
            {step === 2 && (
              <motion.div key="payment" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="card p-6">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-primary-600" /> Payment
                  </h2>

                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 mb-5">
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1">
                      {language === 'km' ? 'ជ្រើសរើសវិធីបង់ប្រាក់' : language === 'zh' ? '选择支付方式' : 'Choose Payment Method'}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      {language === 'km'
                        ? 'អ្នកអាចបង់តាមកាត Visa ឬ Bakong'
                        : language === 'zh'
                          ? '您可以使用 Visa 卡或 Bakong 支付'
                          : 'You can pay with a Visa card or Bakong.'}
                    </p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 mb-5">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('card')}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${
                        paymentMethod === 'card'
                          ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-primary-400'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <CreditCard className="w-4 h-4 text-primary-600" />
                        <p className="font-semibold text-sm text-gray-900 dark:text-white">Visa</p>
                      </div>
                      <p className="text-xs text-gray-500">
                        {language === 'km' ? 'ការទូទាត់មានសុវត្ថិភាពតាមកាត Visa' : language === 'zh' ? '通过 Visa 卡安全支付' : 'Secure payment with Visa card.'}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('bakong')}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${
                        paymentMethod === 'bakong'
                          ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-primary-400'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <QrCode className="w-4 h-4 text-primary-600" />
                        <p className="font-semibold text-sm text-gray-900 dark:text-white">Bakong</p>
                      </div>
                      <p className="text-xs text-gray-500">Pay via Bakong app / KHQR transfer.</p>
                    </button>
                  </div>

                  {paymentMethod === 'card' ? (
                    <div className="space-y-3 mb-5">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                          {language === 'km' ? 'លេខកាត' : language === 'zh' ? '卡号' : 'Card Number'}
                        </label>
                        <input type="text" placeholder="4242 4242 4242 4242" className="input text-sm" defaultValue="4242 4242 4242 4242" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            {language === 'km' ? 'ថ្ងៃផុតកំណត់' : language === 'zh' ? '到期日' : 'Expiry Date'}
                          </label>
                          <input type="text" placeholder="MM/YY" className="input text-sm" defaultValue="12/28" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            CVC
                          </label>
                          <input type="text" placeholder="123" className="input text-sm" defaultValue="123" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                          {language === 'km' ? 'ឈ្មោះលើកាត' : language === 'zh' ? '持卡人姓名' : 'Name on Card'}
                        </label>
                        <input type="text" placeholder="John Doe" className="input text-sm" defaultValue={user?.name} />
                      </div>
                    </div>
                  ) : (
                    <div className="mb-5 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
                      <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-1">Bakong Payment Selected</p>
                      <p className="text-xs text-emerald-700/90 dark:text-emerald-300/90">
                        After placing order, please complete payment in your Bakong app by scanning merchant KHQR or paying to merchant Bakong ID.
                      </p>
                      <a
                        href="https://bakong.nbc.gov.kh/"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block mt-2 text-xs font-medium text-primary-600 hover:underline"
                      >
                        {language === 'km' ? 'បើកគេហទំព័រ Bakong' : language === 'zh' ? '打开 Bakong 官网' : 'Open Bakong official website'}
                      </a>
                    </div>
                  )}

                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
                    {t(language, 'checkoutPrivacyNoticePrefix')}{' '}
                    <Link href="/legal/privacy" className="text-primary-600 hover:underline font-medium">
                      {t(language, 'privacyPolicy')}
                    </Link>
                    {t(language, 'checkoutPrivacyNoticeSuffix')}
                  </p>

                  <div className="flex gap-3">
                    <button onClick={() => setStep(1)} className="btn-secondary flex-1">
                      {language === 'km' ? 'ថយក្រោយ' : language === 'zh' ? '返回' : 'Back'}
                    </button>
                    <button
                      onClick={handlePlaceOrder}
                      disabled={isProcessing}
                      className="btn-primary flex-1"
                    >
                      {isProcessing
                        ? (language === 'km' ? 'កំពុងដំណើរការ...' : language === 'zh' ? '处理中...' : 'Processing...')
                        : `${language === 'km' ? 'ដាក់ការបញ្ជាទិញ' : language === 'zh' ? '提交订单' : 'Place Order'} — ${formatPrice(total)}`}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: Confirmation */}
            {step === 3 && completedOrder && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="card p-10 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                  className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-5"
                >
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </motion.div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {language === 'km' ? 'ការបញ្ជាទិញបានបញ្ជាក់!' : language === 'zh' ? '订单已确认！' : 'Order Confirmed!'}
                </h2>
                <p className="text-gray-500 mb-1">
                  {language === 'km'
                    ? `អរគុណសម្រាប់ការទិញទំនិញ, ${user?.name}!`
                    : language === 'zh'
                      ? `感谢您的购买，${user?.name}！`
                      : `Thank you for your purchase, ${user?.name}!`}
                </p>
                <p className="text-sm font-mono font-bold text-primary-600 mt-3 mb-1">{completedOrder.orderNumber}</p>
                <p className="text-gray-500 text-sm">Total: <span className="font-bold text-gray-900 dark:text-white">{formatPrice(completedOrder.total)}</span></p>
                <p className="text-sm text-gray-400 mt-3">A confirmation email has been sent to {user?.email}</p>

                <div className="flex gap-3 justify-center mt-8">
                  <button onClick={() => router.push('/dashboard/orders')} className="btn-primary">
                    {language === 'km' ? 'មើលការបញ្ជាទិញ' : language === 'zh' ? '查看我的订单' : 'View My Orders'}
                  </button>
                  <button onClick={() => router.push('/products')} className="btn-secondary">
                    {language === 'km' ? 'បន្តទិញ' : language === 'zh' ? '继续购物' : 'Continue Shopping'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Order summary sidebar */}
        {step < 3 && (
          <div className="card p-5 h-fit">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">{t(language, 'orderSummary')}</h3>
            <div className="mb-3">
              <label className="block text-xs text-gray-500 mb-1">{t(language, 'couponCode')}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value);
                    setCouponError('');
                  }}
                  placeholder="WELCOME20"
                  className="input text-xs h-9 flex-1"
                />
                <button onClick={handleApplyCoupon} disabled={isApplyingCoupon} className="btn-secondary text-xs h-9 px-3">
                  {isApplyingCoupon ? '...' : t(language, 'apply')}
                </button>
                {couponInput && (
                  <button onClick={handleClearCoupon} className="btn-secondary text-xs h-9 px-2">
                    {t(language, 'cancel')}
                  </button>
                )}
              </div>
              {couponError && <p className="text-xs text-red-500 mt-1">{couponError}</p>}
            </div>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              {cart?.items.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <span className="line-clamp-1 flex-1 mr-2">{item.product.name} ×{item.quantity}</span>
                  <span className="flex-shrink-0 font-medium">{formatPrice(item.product.price * item.quantity)}</span>
                </div>
              ))}
              <div className="border-t dark:border-gray-700 pt-2 mt-2 space-y-2">
                <div className="flex justify-between"><span>{t(language, 'subtotal')}</span><span>{formatPrice(subtotal)}</span></div>
                <div className="flex justify-between gap-2">
                  <span>
                    {t(language, 'shipping')}
                    <span className="text-gray-400 font-normal text-xs ml-1">
                      ({shippingCarrier === 'JNT' ? 'J&T' : 'VET'})
                    </span>
                  </span>
                  <span className={shipping === 0 ? 'text-green-600' : ''}>
                    {shipping === 0 ? t(language, 'freeUpper') : formatPrice(shipping)}
                  </span>
                </div>
                {appliedCoupon && (
                  <div className="flex justify-between text-green-600">
                    <span>
                      {language === 'km' ? 'បញ្ចុះតម្លៃ' : language === 'zh' ? '优惠' : 'Discount'} ({appliedCoupon.code})
                    </span>
                    <span>-{formatPrice(appliedCoupon.discount)}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setShippingCarrier('VET')}
                    className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                      shippingCarrier === 'VET'
                        ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                        : 'border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400'
                    }`}
                  >
                    VET
                  </button>
                  <button
                    type="button"
                    onClick={() => setShippingCarrier('JNT')}
                    className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                      shippingCarrier === 'JNT'
                        ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                        : 'border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400'
                    }`}
                  >
                    J&T
                  </button>
                </div>
                <div className="flex justify-between text-base font-bold text-gray-900 dark:text-white border-t dark:border-gray-700 pt-2">
                  <span>{t(language, 'total')}</span><span>{formatPrice(total)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {khqrPayment && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm card p-5">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary-600" /> {language === 'km' ? 'ស្កេន KHQR ដើម្បីបង់' : language === 'zh' ? '扫码 KHQR 付款' : 'Scan KHQR to Pay'}
            </h3>
            <p className="text-sm text-gray-500 mb-3">
              {language === 'km' ? 'ចំនួនទឹកប្រាក់' : language === 'zh' ? '金额' : 'Amount'}:{' '}
              <span className="font-semibold text-gray-900 dark:text-white">{formatPrice(khqrPayment.amount)}</span>
            </p>
            <div className="relative w-full aspect-square bg-white rounded-xl p-3 border border-gray-200 overflow-hidden">
              <Image 
                src={khqrPayment.qrImageUrl} 
                alt="KHQR Payment" 
                fill 
                className="object-contain p-2" 
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {language === 'km' ? 'លេខយោង' : language === 'zh' ? '参考号' : 'Ref'}: {khqrPayment.reference}
            </p>
            <p className="text-xs text-gray-500">
              {language === 'km' ? 'ផុតកំណត់' : language === 'zh' ? '过期时间' : 'Expires'}: {new Date(khqrPayment.expiresAt).toLocaleTimeString()}
            </p>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                onClick={async () => {
                  try {
                    await paymentApi.mockConfirmKhqr(khqrPayment.orderId);
                    toast.success('Mock payment confirmed');
                  } catch {
                    toast.error('Unable to confirm payment');
                  }
                }}
                className="btn-secondary text-sm"
              >
                {language === 'km' ? 'ខ្ញុំបានបង់ (សាកល្បង)' : language === 'zh' ? '我已支付（测试）' : 'I Paid (Test)'}
              </button>
              <button onClick={() => setKhqrPayment(null)} className="btn-secondary text-sm">
                {language === 'km' ? 'បិទ' : language === 'zh' ? '关闭' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {cardPaymentOrder &&
        cardPaymentOrder.clientSecret &&
        stripePublishableKey && (
          <StripePaymentModal
            isOpen
            onClose={handleCardModalClose}
            onSuccess={async (paymentIntentId) => {
              await handleCardPaymentSuccess(paymentIntentId);
            }}
            clientSecret={cardPaymentOrder.clientSecret}
            returnUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/checkout?stripe_return=1&order_id=${cardPaymentOrder.id}`}
            publishableKey={stripePublishableKey}
            amount={cardPaymentOrder.amount}
            language={language}
          />
        )}

      {cardPaymentOrder && (!cardPaymentOrder.clientSecret || !stripePublishableKey) && (
        <CardPaymentModal
          isOpen
          onClose={handleCardModalClose}
          onSuccess={() => handleCardPaymentSuccess('mock_card_payment')}
          amount={cardPaymentOrder.amount}
          language={language}
        />
      )}
    </div>
  );
}
