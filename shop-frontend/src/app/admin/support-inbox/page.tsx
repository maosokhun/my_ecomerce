'use client';

import { useEffect, useState } from 'react';
import { useAdminLanguageStore } from '@/store/adminLanguageStore';
import { supportApi } from '@/lib/api';

type Inquiry = {
  id: string;
  name: string;
  phone: string;
  question: string;
  priority?: string;
  transcript?: string;
  createdAt: string;
};

export default function AdminSupportInboxPage() {
  const { language } = useAdminLanguageStore();
  const [rows, setRows] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'ORDER' | 'PAYMENT' | 'PRODUCT' | 'GENERAL'>('ALL');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const title =
    language === 'km' ? 'សំណួរ Chat' : language === 'zh' ? '聊天问题' : 'Support Inbox';

  const loadInquiries = () => {
    supportApi
      .getInquiries()
      .then(({ data }) => {
        setRows(data.data || []);
        setLastUpdated(new Date().toLocaleTimeString());
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadInquiries();
    const timer = setInterval(loadInquiries, 8000);
    return () => clearInterval(timer);
  }, []);

  const parseInquiry = (q: string) => {
    const m = q.match(/^\[PRIORITY:([A-Z_]+)\]\s*/);
    const priority = m?.[1] || 'GENERAL';
    const question = q.replace(/^\[PRIORITY:[A-Z_]+\]\s*/, '');
    return { priority, question };
  };

  const priorityLabel = (priority: string) => {
    if (language === 'km') {
      if (priority === 'ORDER') return 'បញ្ហាកម្មង់';
      if (priority === 'PAYMENT') return 'បញ្ហាបង់ប្រាក់';
      if (priority === 'PRODUCT') return 'សំណួរផលិតផល';
      return 'ទូទៅ';
    }
    if (language === 'zh') {
      if (priority === 'ORDER') return '订单问题';
      if (priority === 'PAYMENT') return '支付问题';
      if (priority === 'PRODUCT') return '产品问题';
      return '一般';
    }
    if (priority === 'ORDER') return 'Order issue';
    if (priority === 'PAYMENT') return 'Payment issue';
    if (priority === 'PRODUCT') return 'Product question';
    return 'General';
  };

  const priorityClasses = (priority: string) => {
    if (priority === 'ORDER') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800';
    if (priority === 'PAYMENT') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800';
    if (priority === 'PRODUCT') return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800';
    return 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-surface-800 dark:text-gray-300 dark:border-gray-700';
  };

  const normalizedRows = rows.map((r) => {
    const parsed = parseInquiry(r.question);
    return { ...r, parsed };
  });
  const filteredRows = normalizedRows.filter((r) => priorityFilter === 'ALL' || r.parsed.priority === priorityFilter);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
          <div className="flex items-center gap-2">
            <select
              className="input h-9 text-sm py-1 px-3"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as 'ALL' | 'ORDER' | 'PAYMENT' | 'PRODUCT' | 'GENERAL')}
            >
              <option value="ALL">{language === 'km' ? 'ទាំងអស់' : language === 'zh' ? '全部' : 'All priorities'}</option>
              <option value="ORDER">{priorityLabel('ORDER')}</option>
              <option value="PAYMENT">{priorityLabel('PAYMENT')}</option>
              <option value="PRODUCT">{priorityLabel('PRODUCT')}</option>
              <option value="GENERAL">{priorityLabel('GENERAL')}</option>
            </select>
            <span className="text-xs text-gray-500">
              {lastUpdated ? `${language === 'km' ? 'អាប់ដេតចុងក្រោយ' : language === 'zh' ? '最后更新' : 'Last update'}: ${lastUpdated}` : ''}
            </span>
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-gray-500 mt-2">Loading...</p>
        ) : filteredRows.length === 0 ? (
          <p className="text-sm text-gray-500 mt-2">
            {language === 'km' ? 'មិនទាន់មានសំណួរ' : language === 'zh' ? '暂无咨询' : 'No inquiries yet.'}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left border-b">
                <tr>
                  <th className="py-2 pr-3">{language === 'km' ? 'ម៉ោង' : language === 'zh' ? '时间' : 'Time'}</th>
                  <th className="py-2 pr-3">{language === 'km' ? 'អតិថិជន' : language === 'zh' ? '客户' : 'Customer'}</th>
                  <th className="py-2 pr-3">{language === 'km' ? 'អាទិភាព' : language === 'zh' ? '优先级' : 'Priority'}</th>
                  <th className="py-2 pr-3">{language === 'km' ? 'សំណួរ' : language === 'zh' ? '问题' : 'Question'}</th>
                  <th className="py-2">{language === 'km' ? 'ប្រវត្តិជជែក' : language === 'zh' ? '聊天记录' : 'Transcript'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  const parsed = r.parsed;
                  return (
                    <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 pr-3 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                      <td className="py-2 pr-3">{r.name} ({r.phone})</td>
                      <td className="py-2 pr-3">
                        <span className={`text-xs px-2 py-1 rounded border ${priorityClasses(parsed.priority)}`}>
                          {priorityLabel(parsed.priority)}
                        </span>
                      </td>
                      <td className="py-2 pr-3">{parsed.question}</td>
                      <td className="py-2 whitespace-pre-wrap text-xs text-gray-500">{r.transcript || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
