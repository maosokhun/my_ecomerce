'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { Tag, Plus, Loader2 } from 'lucide-react';

type Coupon = {
  id: string;
  code: string;
  description?: string | null;
  discountType: string;
  discount: number;
  minOrder?: number | null;
  maxDiscount?: number | null;
  usageLimit?: number | null;
  usedCount: number;
  isActive: boolean;
  expiresAt?: string | null;
  createdAt: string;
};

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: '',
    description: '',
    discountType: 'PERCENTAGE',
    discount: '10',
    minOrder: '',
    maxDiscount: '',
    usageLimit: '',
    expiresAt: '',
  });
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .getCoupons()
      .then(({ data }) => setCoupons(data.data || []))
      .catch(() => toast.error('Failed to load coupons'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim()) {
      toast.error('Coupon code is required');
      return;
    }
    setSaving(true);
    const payload = {
        code: form.code.trim(),
        description: form.description.trim() || undefined,
        discountType: form.discountType,
        discount: Number(form.discount),
        minOrder: form.minOrder ? Number(form.minOrder) : undefined,
        maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : undefined,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
        expiresAt: form.expiresAt || undefined,
      };
    try {
      if (editingCouponId) {
        await adminApi.updateCoupon(editingCouponId, payload);
        toast.success('Coupon updated');
      } else {
        await adminApi.createCoupon(payload);
        toast.success('Coupon created');
      }
      setForm({
        code: '',
        description: '',
        discountType: 'PERCENTAGE',
        discount: '10',
        minOrder: '',
        maxDiscount: '',
        usageLimit: '',
        expiresAt: '',
      });
      setEditingCouponId(null);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to create coupon');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (coupon: Coupon) => {
    setEditingCouponId(coupon.id);
    setForm({
      code: coupon.code,
      description: coupon.description || '',
      discountType: coupon.discountType,
      discount: String(coupon.discount),
      minOrder: coupon.minOrder != null ? String(coupon.minOrder) : '',
      maxDiscount: coupon.maxDiscount != null ? String(coupon.maxDiscount) : '',
      usageLimit: coupon.usageLimit != null ? String(coupon.usageLimit) : '',
      expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt).toISOString().slice(0, 16) : '',
    });
  };

  const removeCoupon = async (id: string) => {
    if (!window.confirm('Delete this coupon?')) return;
    try {
      await adminApi.deleteCoupon(id);
      toast.success('Coupon deleted');
      if (editingCouponId === id) {
        setEditingCouponId(null);
      }
      load();
    } catch {
      toast.error('Failed to delete coupon');
    }
  };

  const formatDiscount = (c: Coupon) => {
    if (c.discountType === 'PERCENTAGE') return `${c.discount}%`;
    return formatPrice(c.discount);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center gap-2">
        <Tag className="w-7 h-7 text-primary-600" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Coupons</h1>
      </div>

      <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5" /> {editingCouponId ? 'Update coupon' : 'Create coupon'}
        </h2>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Code *</label>
            <input
              className="input"
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
              placeholder="SAVE10"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Discount type</label>
            <select
              className="input"
              value={form.discountType}
              onChange={(e) => setForm((p) => ({ ...p, discountType: e.target.value }))}
            >
              <option value="PERCENTAGE">Percentage</option>
              <option value="FIXED">Fixed amount</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Discount value *</label>
            <input
              type="number"
              min={0}
              step={0.01}
              className="input"
              value={form.discount}
              onChange={(e) => setForm((p) => ({ ...p, discount: e.target.value }))}
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <input
              className="input"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min order</label>
            <input
              type="number"
              min={0}
              className="input"
              value={form.minOrder}
              onChange={(e) => setForm((p) => ({ ...p, minOrder: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max discount</label>
            <input
              type="number"
              min={0}
              className="input"
              value={form.maxDiscount}
              onChange={(e) => setForm((p) => ({ ...p, maxDiscount: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Usage limit</label>
            <input
              type="number"
              min={1}
              className="input"
              value={form.usageLimit}
              onChange={(e) => setForm((p) => ({ ...p, usageLimit: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expires (optional)</label>
            <input
              type="datetime-local"
              className="input"
              value={form.expiresAt}
              onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2 lg:col-span-3 flex justify-end">
            {editingCouponId && (
              <button
                type="button"
                onClick={() => {
                  setEditingCouponId(null);
                  setForm({
                    code: '',
                    description: '',
                    discountType: 'PERCENTAGE',
                    discount: '10',
                    minOrder: '',
                    maxDiscount: '',
                    usageLimit: '',
                    expiresAt: '',
                  });
                }}
                className="btn-secondary mr-2"
              >
                Cancel edit
              </button>
            )}
            <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {editingCouponId ? 'Update coupon' : 'Create coupon'}
            </button>
          </div>
        </form>
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white">Existing coupons</h2>
        </div>
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : coupons.length === 0 ? (
          <p className="p-8 text-center text-gray-500">No coupons yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-surface-800/50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Discount</th>
                  <th className="px-4 py-3 font-medium">Used</th>
                  <th className="px-4 py-3 font-medium">Limit</th>
                  <th className="px-4 py-3 font-medium">Active</th>
                  <th className="px-4 py-3 font-medium">Expires</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-3 font-mono font-medium">{c.code}</td>
                    <td className="px-4 py-3">{formatDiscount(c)}</td>
                    <td className="px-4 py-3">{c.usedCount}</td>
                    <td className="px-4 py-3">{c.usageLimit ?? '—'}</td>
                    <td className="px-4 py-3">{c.isActive ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {c.expiresAt ? new Date(c.expiresAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => startEdit(c)} className="text-xs px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700">Edit</button>
                        <button onClick={() => removeCoupon(c.id)} className="text-xs px-2 py-1 rounded-lg border border-red-200 text-red-600 dark:border-red-700">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
