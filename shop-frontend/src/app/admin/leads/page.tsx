'use client';

import { useEffect, useState } from 'react';
import { useAdminLanguageStore } from '@/store/adminLanguageStore';
import { adminApi, leadApi } from '@/lib/api';

type Lead = { id: string; email: string; phone?: string | null; createdAt: string };

export default function AdminLeadsPage() {
  const { language } = useAdminLanguageStore();
  const [rows, setRows] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const title =
    language === 'km' ? 'អ្នកចុះ Subscribe' : language === 'zh' ? '订阅用户' : 'Subscribers';
  const desc =
    language === 'km'
      ? 'បញ្ជីអ្នកចុះ Subscribe'
      : language === 'zh'
        ? '订阅用户列表'
        : 'Subscriber list';

  useEffect(() => {
    leadApi
      .getAll()
      .then(({ data }) => setRows(data.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
    adminApi.markSeen('leads').catch(() => {});
  }, []);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="card p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
        <p className="text-sm text-gray-500 mt-2">{desc}</p>
        <div className="mt-4 overflow-x-auto">
          {loading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-500">No subscribers yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Phone</th>
                  <th className="py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 pr-3">{r.email}</td>
                    <td className="py-2 pr-3">{r.phone || '-'}</td>
                    <td className="py-2">{new Date(r.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
