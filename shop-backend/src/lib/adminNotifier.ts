import prisma from './prisma';
import { formatInvoicePaymentType } from './invoice';
import { sendTelegramMessage } from './notifier';

type AdminEvent = 'NEW_ORDER' | 'PAYMENT_PAID';

const parseCsv = (value?: string): string[] =>
  String(value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

const resolveTargets = (): string[] =>
  parseCsv(process.env.TELEGRAM_CHAT_IDS || process.env.TELEGRAM_CHAT_ID);

const formatMoney = (value: number): string => `$${Number(value || 0).toFixed(2)}`;
const formatDateTime24 = (value: Date): string =>
  value.toLocaleString('en-US', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

const khOrderStatus = (value: string): string => {
  const v = String(value || '').toUpperCase();
  if (v === 'PENDING') return 'កំពុងរង់ចាំ';
  if (v === 'CONFIRMED') return 'បានបញ្ជាក់';
  if (v === 'PROCESSING') return 'កំពុងរៀបចំ';
  if (v === 'SHIPPED') return 'បានដឹកចេញ';
  if (v === 'DELIVERED') return 'បានដឹកដល់';
  if (v === 'CANCELLED') return 'បានបោះបង់';
  if (v === 'REFUNDED') return 'សងប្រាក់វិញ';
  return value || 'មិនមាន';
};

const khPaymentStatus = (value: string): string => {
  const v = String(value || '').toUpperCase();
  if (v === 'PAID') return 'បានបង់';
  if (v === 'PENDING') return 'មិនទាន់បង់';
  if (v === 'FAILED') return 'បង់បរាជ័យ';
  if (v === 'REFUNDED') return 'បានសងប្រាក់វិញ';
  return value || 'មិនមាន';
};

const khShippingCarrier = (value?: string | null): string => {
  const v = String(value || '').toUpperCase();
  if (v === 'VET') return 'VET (វីរះប៊ុនថាំ)';
  if (v === 'JNT') return 'J&T (ជេអែនធី)';
  return 'មិនមាន';
};

const khPaymentType = (value?: string | null): string => {
  const v = String(value || '').toLowerCase();
  if (v === 'bakong') return 'បង់តាមបាគង (KHQR)';
  if (v === 'card') return 'បង់តាម Visa/Master card';
  return 'មិនមាន';
};

export const notifyAdminOrderEvent = async (orderId: string, event: AdminEvent): Promise<void> => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      items: { select: { name: true, quantity: true, price: true } },
      address: true,
    },
  });
  if (!order) return;
  const targets = resolveTargets();
  if (targets.length === 0) return;

  const title = event === 'NEW_ORDER' ? 'មានការកម្មង់ថ្មី' : 'បង់ប្រាក់បានជោគជ័យ';
  const eventTime = event === 'PAYMENT_PAID' ? order.updatedAt : order.createdAt;
  const shippingAddress = order.address
    ? [order.address.province, order.address.district, order.address.commune, order.address.village].filter(Boolean).join(', ')
    : 'មិនមាន';
  const roadNumber = order.address?.roadNumber || order.address?.street || 'មិនមាន';
  const customerName = order.user?.name || 'មិនមាន';
  const customerEmail = order.user?.email || 'មិនមាន';
  const customerPhone = order.address?.phone || order.user?.phone || 'មិនមាន';
  const couponLabel = order.couponCode
    ? `${order.couponCode} (${
        String(order.couponDiscountType || '').toUpperCase() === 'PERCENTAGE'
          ? `${Number(order.couponDiscountValue || 0).toFixed(2)}%`
          : formatMoney(Number(order.couponDiscountValue || 0))
      })`
    : 'មិនមាន';
  const itemsBlock = order.items
    .map(
      (i, idx) =>
        `${idx + 1}) ${i.name}\n` +
        `   - ចំនួន: ${i.quantity}\n` +
        `   - តម្លៃ/មួយ: ${formatMoney(i.price)}\n` +
        `   - សរុប: ${formatMoney(i.price * i.quantity)}`
    )
    .join('\n');
  const totalUnits = order.items.reduce((sum, i) => sum + Number(i.quantity || 0), 0);
  const totalLines = order.items.length;

  const text = [
    `🔔 ${title}`,
    `លេខកម្មង់: ${order.orderNumber}`,
    `ថ្ងៃ/ម៉ោង: ${formatDateTime24(eventTime)}`,
    `អតិថិជន: ${customerName} (${customerEmail})`,
    `ទូរស័ព្ទ: ${customerPhone}`,
    `អាសយដ្ឋានដឹកជញ្ជូន: ${shippingAddress || 'មិនមាន'}`,
    `លេខផ្ទះ/ផ្លូវ: ${roadNumber}`,
    `ប្រភេទបង់ប្រាក់: ${khPaymentType(order.paymentMethod)}`,
    `ស្ថានភាពបង់ប្រាក់: ${khPaymentStatus(order.paymentStatus)}`,
    `ស្ថានភាពកម្មង់: ${khOrderStatus(order.status)}`,
    `ក្រុមហ៊ុនដឹកជញ្ជូន: ${khShippingCarrier(order.shippingCarrier)}`,
    `Coupon: ${couponLabel}`,
    `តម្លៃដើម: ${formatMoney(order.subtotal)}`,
    `បញ្ចុះតម្លៃ: -${formatMoney(order.discount)}`,
    `ថ្លៃដឹកជញ្ជូន: ${formatMoney(order.shippingCost)}`,
    `តម្លៃសរុប: ${formatMoney(order.total)}`,
    `សរុបមុខទំនិញ: ${totalLines} មុខ`,
    `សរុបចំនួន: ${totalUnits}`,
    '',
    'មុខទំនិញ:',
    itemsBlock || 'មិនមានទំនិញ',
  ].join('\n');

  await Promise.allSettled(targets.map((chatId) => sendTelegramMessage({ chatId, text })));
};

export const notifyAdminUserCancelledOrder = async (orderId: string): Promise<void> => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: { select: { name: true, phone: true } } },
  });
  if (!order) return;
  const targets = resolveTargets();
  if (targets.length === 0) return;

  const text = [
    '⚠️ អតិថិជនបានបោះបង់ Order',
    `លេខកម្មង់: ${order.orderNumber}`,
    `ថ្ងៃ/ម៉ោង: ${formatDateTime24(new Date())}`,
    `អតិថិជន: ${order.user?.name || 'មិនមាន'} (${order.user?.phone || 'មិនមាន'})`,
    `ស្ថានភាពបង់ប្រាក់: ${khPaymentStatus(order.paymentStatus)}`,
    `ស្ថានភាពកម្មង់: ${khOrderStatus(order.status)}`,
  ].join('\n');

  await Promise.allSettled(targets.map((chatId) => sendTelegramMessage({ chatId, text })));
};

export const notifyAdminOrderStatusChanged = async (
  orderId: string,
  oldStatus: string,
  newStatus: string
): Promise<void> => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: { select: { name: true, phone: true } } },
  });
  if (!order) return;
  const targets = resolveTargets();
  if (targets.length === 0) return;

  const text = [
    '🛠️ Admin បានកែប្រែស្ថានភាព Order',
    `លេខកម្មង់: ${order.orderNumber}`,
    `ថ្ងៃ/ម៉ោង: ${formatDateTime24(new Date())}`,
    `អតិថិជន: ${order.user?.name || 'មិនមាន'} (${order.user?.phone || 'មិនមាន'})`,
    `ស្ថានភាពចាស់: ${khOrderStatus(oldStatus)}`,
    `ស្ថានភាពថ្មី: ${khOrderStatus(newStatus)}`,
    `ស្ថានភាពបង់ប្រាក់: ${khPaymentStatus(order.paymentStatus)}`,
  ].join('\n');

  await Promise.allSettled(targets.map((chatId) => sendTelegramMessage({ chatId, text })));
};
