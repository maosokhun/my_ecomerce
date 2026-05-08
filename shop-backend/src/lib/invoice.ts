import prisma from './prisma';
import { sendEmail, sendSms } from './notifier';
import type { AppLang } from './requestLang';

const formatMoney = (value: number): string => `$${value.toFixed(2)}`;

const formatDate = (value: Date): string =>
  value.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Human-readable payment type for invoices (matches checkout: card vs Bakong). */
export const formatInvoicePaymentType = (
  method: string | null | undefined,
  custom?: { card?: string; bakong?: string }
): string => {
  const m = (method || '').toLowerCase();
  if (m === 'card') return custom?.card || 'Paid by Visa / card';
  if (m === 'bakong') return custom?.bakong || 'Paid by Bakong (KHQR)';
  return method?.trim() || 'N/A';
};

export interface InvoiceDetails {
  invoiceNumber: string;
  orderNumber: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  shippingAddress: string;
  /** Raw value from order, e.g. card | bakong */
  paymentMethod: string;
  /** Same information for display, e.g. "Paid by Visa / card" */
  paymentTypeLabel: string;
  paymentStatus: string;
  note?: string;
  subtotal: number;
  discount: number;
  shippingCost: number;
  /** Raw order value: VET | JNT */
  shippingCarrier?: string | null;
  /** Display label, e.g. VET or J&T */
  shippingCarrierLabel?: string | null;
  tax: number;
  total: number;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    lineTotal: number;
  }>;
  textInvoice: string;
  htmlInvoice: string;
}

async function resolveAddressByLang(
  ids: { provinceId?: string | null; districtId?: string | null; communeId?: string | null; villageId?: string | null },
  lang: AppLang
): Promise<string | null> {
  if (!ids.provinceId || !ids.districtId || !ids.communeId || !ids.villageId) return null;
  const [p, d, c, v] = await Promise.all([
    prisma.cambodiaProvince.findUnique({ where: { id: ids.provinceId } }),
    prisma.cambodiaDistrict.findUnique({ where: { id: ids.districtId } }),
    prisma.cambodiaCommune.findUnique({ where: { id: ids.communeId } }),
    prisma.cambodiaVillage.findUnique({ where: { id: ids.villageId } }),
  ]);
  const pick = <T extends { nameKm: string; nameEn?: string | null; nameZh?: string | null }>(x: T | null) =>
    x ? (lang === 'en' ? x.nameEn || x.nameKm : lang === 'zh' ? x.nameZh || x.nameKm : x.nameKm) : '';
  const parts = [pick(p), pick(d), pick(c), pick(v)].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export const getInvoiceDetails = async (orderId: string, lang: AppLang = 'km'): Promise<InvoiceDetails | null> => {
  const [order, settings] = await Promise.all([
    prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { name: true, email: true, phone: true } },
        items: true,
        address: true,
      },
    }),
    prisma.siteSettings.findUnique({ where: { id: 'default' } }),
  ]);

  if (!order) return null;
  const invoiceCfg = ((settings?.footerInfo as { invoice?: unknown } | null)?.invoice || {}) as {
    shopName?: string;
    supportEmail?: string;
    supportPhone?: string;
    shopAddress?: string;
    footerNote?: string;
    paymentLabelCard?: string;
    paymentLabelBakong?: string;
  };
  const shopName = invoiceCfg.shopName || settings?.siteName || 'ShopHub';
  const supportEmail = invoiceCfg.supportEmail || 'support@shophub.com';
  const supportPhone = invoiceCfg.supportPhone || '+1 (555) 000-1000';
  const shopAddress = invoiceCfg.shopAddress || 'N/A';
  const footerNote = invoiceCfg.footerNote || '';

  const paymentTypeLabel = formatInvoicePaymentType(order.paymentMethod, {
    card: invoiceCfg.paymentLabelCard,
    bakong: invoiceCfg.paymentLabelBakong,
  });

  const invoiceNumber = `INV-${order.orderNumber}`;
  const itemsRows = order.items
    .map(
      (item, idx) =>
        `${idx + 1}. ${item.name} x${item.quantity} @ ${formatMoney(item.price)} = ${formatMoney(
          item.price * item.quantity
        )}`
    )
    .join('\n');

  const shippingSnapshot =
    order.shippingAddress && typeof order.shippingAddress === 'object'
      ? (order.shippingAddress as {
          province?: string;
          district?: string;
          commune?: string;
          village?: string;
          roadNumber?: string;
          street?: string;
          city?: string;
          state?: string;
          zipCode?: string;
        })
      : null;

  const localized = order.address
    ? await resolveAddressByLang(
        {
          provinceId: order.address.provinceId,
          districtId: order.address.districtId,
          communeId: order.address.communeId,
          villageId: order.address.villageId,
        },
        lang
      )
    : null;
  const areaParts = localized
    ? localized.split(',').map((x) => x.trim()).filter(Boolean)
    : [
        order.address?.province,
        order.address?.district,
        order.address?.commune,
        order.address?.village,
        shippingSnapshot?.province,
        shippingSnapshot?.district,
        shippingSnapshot?.commune,
        shippingSnapshot?.village,
      ].filter(Boolean) as string[];
  const uniqueAreaParts = Array.from(new Set(areaParts.map((x) => x.trim()).filter(Boolean)));
  const roadParts = [
    order.address?.roadNumber,
    order.address?.street,
    shippingSnapshot?.roadNumber,
    shippingSnapshot?.street,
  ]
    .filter(Boolean)
    .map((x) => String(x).trim())
    .filter(Boolean);
  const extraParts = [shippingSnapshot?.city, shippingSnapshot?.state, shippingSnapshot?.zipCode]
    .filter(Boolean)
    .map((x) => String(x).trim())
    .filter(Boolean);
  const shippingAddress = [...uniqueAreaParts, ...roadParts, ...extraParts].join(', ') || 'Not provided';


  const shippingCarrierLabel =
    order.shippingCarrier === 'JNT' ? 'J&T' : order.shippingCarrier === 'VET' ? 'VET' : null;
  const shippingLine = shippingCarrierLabel
    ? `Shipping (${shippingCarrierLabel}): ${formatMoney(order.shippingCost)}`
    : `Shipping: ${formatMoney(order.shippingCost)}`;

  const textInvoice = [
    `Invoice: ${invoiceNumber}`,
    `Order Number: ${order.orderNumber}`,
    `Date: ${formatDate(order.createdAt)}`,
    `Customer: ${order.user.name}`,
    '',
    'Items:',
    itemsRows || 'No items',
    '',
    `Subtotal: ${formatMoney(order.subtotal)}`,
    `Discount: -${formatMoney(order.discount)}`,
    shippingLine,
    `Total: ${formatMoney(order.total)}`,
    '',
    `Payment type: ${paymentTypeLabel}`,
    `Payment Status: ${order.paymentStatus}`,
    `Shipping Address: ${shippingAddress}`,
    `Contact Phone: ${order.address?.phone || order.user.phone || 'N/A'}`,
    `Note: ${order.notes?.trim() || 'N/A'}`,
  ].join('\n');

  const htmlInvoice = `
    <div style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto; color: #1f2937;">
      <h2 style="margin-bottom: 4px;">Invoice ${invoiceNumber}</h2>
      <p style="margin-top: 0; color: #6b7280;">Order ${order.orderNumber} • ${formatDate(order.createdAt)}</p>
      <p><strong>Store:</strong> ${shopName}</p>
      <p><strong>Store Address:</strong> ${shopAddress}</p>
      <p><strong>Customer:</strong> ${order.user.name}</p>
      <p><strong>Email:</strong> ${order.user.email}</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
      <h3 style="margin: 0 0 10px 0;">Items</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th align="left" style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Product</th>
            <th align="right" style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Qty</th>
            <th align="right" style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Price</th>
            <th align="right" style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${order.items
            .map(
              (item) => `
            <tr>
              <td style="padding: 8px 0;">${item.name}</td>
              <td align="right" style="padding: 8px 0;">${item.quantity}</td>
              <td align="right" style="padding: 8px 0;">${formatMoney(item.price)}</td>
              <td align="right" style="padding: 8px 0;">${formatMoney(item.price * item.quantity)}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
      <div style="text-align: right;">
        <p>Subtotal: <strong>${formatMoney(order.subtotal)}</strong></p>
        <p>Discount: <strong>-${formatMoney(order.discount)}</strong></p>
        <p>Shipping${shippingCarrierLabel ? ` (${shippingCarrierLabel})` : ''}: <strong>${formatMoney(
          order.shippingCost
        )}</strong></p>
        <p style="font-size: 18px;">Grand Total: <strong>${formatMoney(order.total)}</strong></p>
      </div>
      <p><strong>Shipping Address:</strong> ${shippingAddress}</p>
      <p><strong>Payment type:</strong> ${paymentTypeLabel}</p>
      <p><strong>Payment Status:</strong> ${order.paymentStatus}</p>
      <p><strong>Contact Phone:</strong> ${order.address?.phone || order.user.phone || 'N/A'}</p>
      <p><strong>Note:</strong> ${order.notes?.trim() || 'N/A'}</p>
      <p><strong>Support:</strong> ${supportEmail}${supportPhone ? ` | ${supportPhone}` : ''}</p>
      ${footerNote ? `<p><strong>Message:</strong> ${footerNote}</p>` : ''}
    </div>
  `;

  return {
    invoiceNumber,
    orderNumber: order.orderNumber,
    createdAt: order.createdAt.toISOString(),
    customerName: order.user.name,
    customerEmail: order.user.email || '',
    customerPhone: order.user.phone,
    shippingAddress,
    paymentMethod: order.paymentMethod || 'N/A',
    paymentTypeLabel,
    paymentStatus: order.paymentStatus,
    note: order.notes || undefined,
    subtotal: order.subtotal,
    discount: order.discount,
    shippingCost: order.shippingCost,
    shippingCarrier: order.shippingCarrier,
    shippingCarrierLabel,
    tax: order.tax,
    total: order.total,
    items: order.items.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      lineTotal: item.price * item.quantity,
    })),
    textInvoice,
    htmlInvoice,
  };
};

export const sendInvoiceNotification = async (orderId: string): Promise<void> => {
  const invoice = await getInvoiceDetails(orderId);
  if (!invoice) return;

  try {
    await sendEmail({
      to: invoice.customerEmail,
      subject: `Your Invoice ${invoice.invoiceNumber}`,
      html: invoice.htmlInvoice,
      text: invoice.textInvoice,
    });
  } catch (error) {
    console.error('[Invoice] Email send failed:', error);
  }

  if (invoice.customerPhone) {
    try {
      await sendSms({
        to: invoice.customerPhone,
        text: `ShopHub Invoice ${invoice.invoiceNumber} for order ${invoice.orderNumber}. Total: ${formatMoney(
          invoice.total
        )}. ${invoice.paymentTypeLabel}.`,
      });
    } catch (error) {
      console.error('[Invoice] SMS send failed:', error);
    }
  }
};
