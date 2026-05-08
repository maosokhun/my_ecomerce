'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronRight, Download, FileText, Package, Printer, QrCode, CreditCard, XCircle } from 'lucide-react';
import Image from 'next/image';
import { Invoice, Order } from '@/types';
import { orderApi, paymentApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useLanguageStore } from '@/store/languageStore';
import { t, paymentTypeForInvoice } from '@/lib/i18n';
import { formatDate, formatPrice, getOrderStatusColor, getPaymentStatusColor } from '@/lib/utils';
import toast from 'react-hot-toast';
import { CardPaymentModal } from '@/components/payment/CardPaymentModal';

export default function OrderDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, isAuthChecked } = useAuthStore();
  const { language } = useLanguageStore();

  const [order, setOrder] = useState<Order | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPaying, setIsPaying] = useState(false);
  const [khqrPayment, setKhqrPayment] = useState<{
    orderId: string;
    reference: string;
    qrImageUrl: string;
    expiresAt: string;
    amount: number;
  } | null>(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'card' | 'bakong'>('card');

  const parseOrderIdFromRoute = (raw: string) => {
    if (!raw) return raw;
    const decoded = decodeURIComponent(raw);
    if (!decoded.includes('__')) return decoded;
    const parts = decoded.split('__');
    return parts[parts.length - 1] || decoded;
  };

  const escapeHtml = (value: string) =>
    value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');

  const buildFallbackInvoiceText = () => {
    if (!order) return '';
    const lines = order.items.map(
      (item, idx) =>
        `${idx + 1}. ${item.name} x${item.quantity} = ${formatPrice(item.price * item.quantity, language)}`
    );
    return [
      `${t(language, 'orderLabel')}: ${order.orderNumber}`,
      `${t(language, 'dateLabel')}: ${formatDate(order.createdAt, language)}`,
      `${t(language, 'customerLabel')}: ${order.user?.name || t(language, 'customerLabel')}`,
      `${t(language, 'phoneLabel')}: ${order.address?.phone || order.user?.phone || 'N/A'}`,
      `${t(language, 'addressLabel')}: ${order.address ? [order.address.province, order.address.district, order.address.commune, order.address.village].filter(Boolean).join(', ') : 'Not provided'}`,
      `${t(language, 'noteLabel')}: ${order.notes?.trim() || 'N/A'}`,
      '',
      `${t(language, 'items')}:`,
      ...lines,
      '',
      `${t(language, 'subtotal')}: ${formatPrice(order.subtotal, language)}`,
      `${t(language, 'shipping')}${
        order.shippingCarrier
          ? ` (${order.shippingCarrier === 'JNT' ? 'J&T' : 'VET'})`
          : ''
      }: ${formatPrice(order.shippingCost, language)}`,
      `${t(language, 'total')}: ${formatPrice(order.total, language)}`,
      `${t(language, 'paymentType')}: ${paymentTypeForInvoice(language, order.paymentMethod)}`,
    ].join('\n');
  };

  const handleDownloadReceipt = async () => {
    let activeInvoice = invoice;
    if (!activeInvoice && order?.id) {
      try {
        const { data } = await orderApi.getInvoice(order.id);
        activeInvoice = data.data || null;
        if (activeInvoice) setInvoice(activeInvoice);
      } catch {
        // Fallback to order data below
      }
    }

    const invoiceText = activeInvoice?.textInvoice || buildFallbackInvoiceText();
    if (!invoiceText) {
      toast.error(t(language, 'receiptDataNotReady'));
      return;
    }

    const receiptText = [
      `${t(language, 'brand')} ${t(language, 'receipt')}`,
      t(language, 'brand') + ' Online Store',
      'support@shophub.com | +1 (555) 000-1000',
      '----------------------------------------',
      invoiceText,
    ].join('\n');
    const blob = new Blob([receiptText], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${activeInvoice?.invoiceNumber || order?.orderNumber || 'receipt'}-receipt.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  };

  const handlePrintReceipt = () => {
    if (!invoice) return;

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) return;

    const itemsHtml = invoice.items
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.name)}</td>
            <td style="text-align:center;">${item.quantity}</td>
            <td style="text-align:right;">${formatPrice(item.lineTotal, language)}</td>
          </tr>
        `
      )
      .join('');

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(invoice.invoiceNumber)} Receipt</title>
          <style>
            @page { size: 80mm auto; margin: 8mm; }
            body {
              font-family: "Courier New", monospace;
              color: #111;
              margin: 0;
              display: flex;
              justify-content: center;
            }
            .receipt {
              width: 76mm;
              padding: 8px 10px 14px;
              border: 1px dashed #d1d5db;
            }
            .center { text-align: center; }
            .title {
              font-size: 28px;
              font-weight: 700;
              letter-spacing: 1px;
              margin: 6px 0 10px;
            }
            .shop-name {
              font-size: 16px;
              font-weight: 700;
              margin-bottom: 3px;
            }
            .muted { font-size: 12px; color: #444; line-height: 1.35; }
            .line { border-top: 1px solid #222; margin: 10px 0 6px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { font-size: 12px; padding: 2px 0; }
            th { border-bottom: 1px dashed #777; padding-bottom: 6px; }
            .summary { margin-top: 8px; border-top: 1px dashed #777; padding-top: 8px; }
            .row {
              display: flex;
              justify-content: space-between;
              font-size: 12px;
              margin: 2px 0;
            }
            .total {
              display: flex;
              justify-content: space-between;
              font-weight: 700;
              font-size: 14px;
              margin-top: 6px;
              padding-top: 6px;
              border-top: 1px solid #222;
            }
            .barcode {
              font-family: "Libre Barcode 39", "Courier New", monospace;
              font-size: 40px;
              letter-spacing: 1px;
              line-height: 1;
              margin-top: 12px;
            }
            .invoice-id {
              font-size: 11px;
              letter-spacing: 0.5px;
              margin-top: 2px;
            }
            .thanks {
              margin-top: 8px;
              font-size: 11px;
            }
          </style>
          <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+39&display=swap" rel="stylesheet">
        </head>
        <body>
          <div class="receipt">
            <div class="center title">${t(language, 'receipt')}</div>
            <div class="center shop-name">${t(language, 'brand')} Online Store</div>
            <div class="center muted">123 Commerce St, New York, NY 10001</div>
            <div class="center muted">${t(language, 'dateLabel')}: ${escapeHtml(formatDate(invoice.createdAt, language))}</div>
            <div class="center muted">${t(language, 'orderLabel')}: ${escapeHtml(invoice.orderNumber)}</div>
            <div class="line"></div>
            <div class="muted">${t(language, 'customerLabel')}: ${escapeHtml(invoice.customerName)}</div>
            <div class="muted">${t(language, 'phoneLabel')}: ${escapeHtml(invoice.customerPhone || 'N/A')}</div>
            <div class="muted">${t(language, 'addressLabel')}: ${escapeHtml(invoice.shippingAddress || 'Not provided')}</div>
            <div class="muted">${t(language, 'noteLabel')}: ${escapeHtml(invoice.note || 'N/A')}</div>
            <div class="muted">${t(language, 'receiptNoLabel')}: ${escapeHtml(invoice.invoiceNumber)}</div>
            <div class="muted">${t(language, 'paymentType')}: ${escapeHtml(paymentTypeForInvoice(language, invoice.paymentMethod))}</div>

            <table>
              <thead>
                <tr>
                  <th style="text-align:left;">${t(language, 'descriptionLabel')}</th>
                  <th style="text-align:center;">${t(language, 'qtyLabel')}</th>
                  <th style="text-align:right;">${t(language, 'priceLabel')}</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
            </table>

            <div class="summary">
              <div class="row"><span>${t(language, 'subtotal')}</span><span>${formatPrice(invoice.subtotal, language)}</span></div>
              <div class="row"><span>${t(language, 'shipping')}${
                invoice.shippingCarrierLabel
                  ? ` (${escapeHtml(invoice.shippingCarrierLabel)})`
                  : ''
              }</span><span>${formatPrice(invoice.shippingCost, language)}</span></div>
              <div class="total"><span>${t(language, 'total')}</span><span>${formatPrice(invoice.total, language)}</span></div>
            </div>

            <div class="center barcode">*${escapeHtml(invoice.orderNumber)}*</div>
            <div class="center invoice-id">#${escapeHtml(invoice.invoiceNumber)}</div>
            <div class="center thanks">${t(language, 'thankYou')}</div>
          </div>
          <script>
            window.onload = function () { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  useEffect(() => {
    if (!isAuthChecked) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    const id = parseOrderIdFromRoute(String(params.id));

    Promise.all([orderApi.getById(id), orderApi.getInvoice(id, language)])
      .then(([orderRes, invoiceRes]) => {
        const nextOrder = orderRes.data.data || null;
        setOrder(nextOrder);
        const method = String(nextOrder?.paymentMethod || '').toLowerCase();
        setSelectedPaymentMethod(method === 'bakong' ? 'bakong' : 'card');
        setInvoice(invoiceRes.data.data || null);
      })
      .catch(() => {
        toast.error(t(language, 'failedLoadProduct'));
        router.push('/dashboard/orders');
      })
      .finally(() => setLoading(false));
  }, [isAuthChecked, isAuthenticated, params.id, router, language]);

  useEffect(() => {
    if (!khqrPayment) return;
    const poll = setInterval(async () => {
      try {
        const { data } = await paymentApi.getKhqrStatus(khqrPayment.orderId);
        if (data.data.paymentStatus === 'PAID') {
          clearInterval(poll);
          setKhqrPayment(null);
          toast.success('Payment confirmed!');
          // Refresh order data
          const { data: orderData } = await orderApi.getById(khqrPayment.orderId);
          setOrder(orderData.data);
          const { data: invData } = await orderApi.getInvoice(khqrPayment.orderId, language);
          setInvoice(invData.data);
        }
      } catch {
        // keep polling
      }
    }, 4000);
    return () => clearInterval(poll);
  }, [khqrPayment, language]);

  const handlePayNow = async () => {
    if (!order) return;
    setIsPaying(true);
    try {
      if (selectedPaymentMethod === 'bakong') {
        const { data } = await paymentApi.createKhqr(order.id);
        setKhqrPayment({
          orderId: order.id,
          reference: data.data.reference,
          qrImageUrl: data.data.qrImageUrl,
          expiresAt: data.data.expiresAt,
          amount: data.data.amount,
        });
      } else {
        // Show mock card payment modal
        setShowCardModal(true);
      }
    } catch {
      toast.error('Failed to initiate payment');
    } finally {
      setIsPaying(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!order) return;
    const ok = window.confirm(
      language === 'km'
        ? 'តើអ្នកចង់បោះបង់ការបញ្ជាទិញនេះមែនទេ?'
        : language === 'zh'
          ? '确定要取消此订单吗？'
          : 'Are you sure you want to cancel this order?'
    );
    if (!ok) return;
    try {
      await orderApi.cancel(order.id);
      const { data: orderData } = await orderApi.getById(order.id);
      setOrder(orderData.data);
      toast.success(language === 'km' ? 'បានបោះបង់កម្មង់' : language === 'zh' ? '订单已取消' : 'Order cancelled');
    } catch {
      toast.error(language === 'km' ? 'បោះបង់មិនបាន' : language === 'zh' ? '取消失败' : 'Cancel failed');
    }
  };

  const handleCardPaymentSuccess = async () => {
    if (!order) return;
    try {
      await orderApi.confirmPayment({ orderId: order.id, paymentIntentId: 'mock_card_payment' });
      toast.success('Payment confirmed!');
      // Refresh order data
      const { data: orderData } = await orderApi.getById(order.id);
      setOrder(orderData.data);
      const { data: invData } = await orderApi.getInvoice(order.id, language);
      setInvoice(invData.data);
    } catch {
      toast.error('Failed to confirm payment.');
    }
  };

  if (!isAuthChecked) return null;

  if (loading) {
    return (
      <div className="page-container py-8">
        <div className="card p-6 animate-pulse h-64" />
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="page-container py-8 space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/" className="hover:text-primary-600">{t(language, 'breadcrumbHome')}</Link>
        <ChevronRight className="w-4 h-4" />
        <Link href="/dashboard" className="hover:text-primary-600">{t(language, 'breadcrumbAccount')}</Link>
        <ChevronRight className="w-4 h-4" />
        <Link href="/dashboard/orders" className="hover:text-primary-600">{t(language, 'breadcrumbOrders')}</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-900 dark:text-white">{order.orderNumber}</span>
      </div>

      <div className="card p-6">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{order.orderNumber}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {t(language, 'placedOn').replace('{date}', formatDate(order.createdAt, language))}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-2">
              <span className={`badge ${getOrderStatusColor(order.status)}`}>
                {t(language, `orderStatus_${order.status}`)}
              </span>
              <span className={`badge ${getPaymentStatusColor(order.paymentStatus)}`}>
                {t(language, order.paymentStatus === 'PAID' ? 'paymentStatus_PAID' : 'paymentStatus_PENDING')}
              </span>
            </div>
          </div>
        </div>
        {order.paymentStatus === 'PENDING' && (
          <div className="mt-1 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="flex items-center rounded-xl border border-gray-200 dark:border-gray-700 p-1 bg-white dark:bg-surface-900 w-fit">
              <button
                type="button"
                onClick={() => setSelectedPaymentMethod('card')}
                className={`px-3 py-1.5 text-xs rounded-lg ${
                  selectedPaymentMethod === 'card'
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                Visa/Master
              </button>
              <button
                type="button"
                onClick={() => setSelectedPaymentMethod('bakong')}
                className={`px-3 py-1.5 text-xs rounded-lg ${
                  selectedPaymentMethod === 'bakong'
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                Bakong
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handlePayNow}
                disabled={isPaying}
                className="btn-primary py-2 px-4 text-sm flex items-center gap-2 shadow-md shadow-primary-500/20"
              >
                {selectedPaymentMethod === 'bakong' ? <QrCode className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                {isPaying ? '...' : t(language, 'payNow')}
              </button>
              {(order.status === 'PENDING' || order.status === 'CONFIRMED') && (
                <button
                  type="button"
                  onClick={handleCancelOrder}
                  className="btn-secondary py-2 px-4 text-sm flex items-center gap-2 text-red-600 dark:text-red-400"
                >
                  <XCircle className="w-4 h-4" />
                  {language === 'km' ? 'បោះបង់កម្មង់' : language === 'zh' ? '取消订单' : 'Cancel order'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Order Status Stepper */}
        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
          <div className="relative">
            <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 dark:bg-gray-800 -translate-y-1/2 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary-500 transition-all duration-500"
                style={{
                  width: order.status === 'PENDING' ? '0%' : 
                         order.status === 'CONFIRMED' ? '33%' : 
                         order.status === 'PROCESSING' || order.status === 'SHIPPED' ? '66%' : 
                         order.status === 'DELIVERED' ? '100%' : '0%'
                }}
              />
            </div>
            <div className="relative flex justify-between">
              {[
                { key: 'PENDING', label: 'Pending' },
                { key: 'CONFIRMED', label: 'Confirmed' },
                { key: 'SHIPPED', label: 'Shipped' },
                { key: 'DELIVERED', label: 'Delivered' }
              ].map((step, idx, arr) => {
                const isCompleted = arr.findIndex(s => s.key === order.status) >= idx || order.status === 'DELIVERED';
                const isCurrent = order.status === step.key || (order.status === 'PROCESSING' && step.key === 'CONFIRMED');
                const isCancelled = order.status === 'CANCELLED';
                return (
                  <div key={step.key} className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 transition-colors z-10 ${
                      isCancelled ? 'bg-red-100 border-red-500 text-red-500' :
                      isCompleted ? 'bg-primary-500 border-primary-100 dark:border-primary-900 border-opacity-50 text-white' : 
                      'bg-white dark:bg-surface-900 border-gray-200 dark:border-gray-700 text-gray-400'
                    }`}>
                      <div className="w-2.5 h-2.5 rounded-full bg-current" />
                    </div>
                    <p className={`mt-2 text-xs font-semibold ${
                      isCancelled ? 'text-red-500' :
                      isCurrent ? 'text-primary-600' : 
                      isCompleted ? 'text-gray-900 dark:text-white' : 
                      'text-gray-400'
                    }`}>
                      {step.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {order.paymentStatus === 'PENDING' && (
          <div className="mt-4 p-3 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-surface-800 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-gray-500 dark:text-gray-300" />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {t(language, 'unpaidWarning')}
            </p>
          </div>
        )}
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t(language, 'purchasedProducts')}</h2>
        <div className="space-y-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
              <div className="w-12 h-12 rounded-lg bg-white dark:bg-gray-900 flex items-center justify-center">
                <Package className="w-5 h-5 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                <p className="text-xs text-gray-500">
                  {t(language, 'qtyLabel')}: {item.quantity} • {formatPrice(item.price, language)} {t(language, 'each')}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900 dark:text-white">{formatPrice(item.price * item.quantity, language)}</p>
                <Link href="/products" className="text-xs text-primary-600 hover:underline">{t(language, 'browseMore').split(' ')[0]}</Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5" /> {t(language, 'printReceipt')}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadReceipt}
              className="btn-primary text-sm px-3 py-2"
            >
              <Download className="w-4 h-4" /> {t(language, 'download')}
            </button>
            <button onClick={handlePrintReceipt} className="btn-secondary text-sm px-3 py-2">
              <Printer className="w-4 h-4" /> {t(language, 'print')}
            </button>
          </div>
        </div>

        {invoice ? (
          <div className="text-sm">
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-4 space-y-1">
              <p className="font-semibold text-gray-900 dark:text-white">{t(language, 'brand')} Online Store</p>
              <p className="text-xs text-gray-500 border-none">support@shophub.com | +1 (555) 000-1000</p>
              <p className="text-xs text-gray-500">#{t(language, 'receiptNoLabel')}: {invoice.invoiceNumber}</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 mt-3 text-sm">
              <p><span className="text-gray-500 font-medium">{t(language, 'customerLabel')}:</span> {invoice.customerName}</p>
              <p><span className="text-gray-500 font-medium">{t(language, 'dateLabel')}:</span> {formatDate(invoice.createdAt, language)}</p>
              <p><span className="text-gray-500 font-medium">{t(language, 'orderLabel')}:</span> {invoice.orderNumber}</p>
              <p><span className="text-gray-500 font-medium">{t(language, 'items')}:</span> {invoice.items.length}</p>
              <p><span className="text-gray-500 font-medium">{t(language, 'phoneLabel')}:</span> {invoice.customerPhone || 'N/A'}</p>
              <p><span className="text-gray-500 font-medium">{t(language, 'noteLabel')}:</span> {invoice.note || 'N/A'}</p>
            </div>
            <p className="mt-2"><span className="text-gray-500 font-medium">{t(language, 'addressLabel')}:</span> {invoice.shippingAddress}</p>
            <p className="mt-2">
              <span className="text-gray-500 font-medium">{t(language, 'paymentType')}:</span>{' '}
              {paymentTypeForInvoice(language, invoice.paymentMethod)}
            </p>

            <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700 space-y-1">
              <p className="flex justify-between"><span>{t(language, 'subtotal')}</span><span>{formatPrice(invoice.subtotal, language)}</span></p>
              <p className="flex justify-between">
                <span>
                  {t(language, 'shipping')}
                  {invoice.shippingCarrierLabel ? (
                    <span className="text-gray-400 font-normal text-xs ml-1">({invoice.shippingCarrierLabel})</span>
                  ) : null}
                </span>
                <span>{formatPrice(invoice.shippingCost, language)}</span>
              </p>
              <p className="flex justify-between font-bold text-base pt-1 text-primary-600"><span>{t(language, 'totalPaid')}</span><span>{formatPrice(invoice.total, language)}</span></p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">{t(language, 'invoiceNotAvailable')}</p>
        )}
      </div>

      {khqrPayment && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm card p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary-600" /> {t(language, 'scanToPay')}
            </h3>
            <p className="text-sm text-gray-500 mb-4">{t(language, 'total')}: <span className="font-semibold text-gray-900 dark:text-white">{formatPrice(khqrPayment.amount, language)}</span></p>
            
            <div className="relative w-full aspect-square bg-white rounded-2xl p-4 border border-gray-200 overflow-hidden shadow-inner">
              <Image 
                src={khqrPayment.qrImageUrl} 
                alt="KHQR Payment" 
                fill 
                className="object-contain p-2" 
              />
            </div>
            
            <div className="mt-4 space-y-1">
              <p className="text-[10px] text-gray-400 font-bold">{t(language, 'referenceNumber')}</p>
              <p className="text-sm font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg">{khqrPayment.reference}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                onClick={async () => {
                  try {
                    await paymentApi.mockConfirmKhqr(khqrPayment.orderId);
                    toast.success('Mock payment confirmed');
                  } catch {
                    toast.error('Unable to confirm payment');
                  }
                }}
                className="btn-secondary text-sm py-2.5"
              >
                {t(language, 'iPaidTest')}
              </button>
              <button onClick={() => setKhqrPayment(null)} className="btn-secondary text-sm py-2.5">
                {t(language, 'close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCardModal && order && (
        <CardPaymentModal
          isOpen={showCardModal}
          onClose={() => setShowCardModal(false)}
          onSuccess={handleCardPaymentSuccess}
          amount={order.total}
          language={language}
        />
      )}
    </div>
  );
}
