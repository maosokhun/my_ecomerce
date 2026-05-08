'use client';

import { useMemo, useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { supportApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useLanguageStore } from '@/store/languageStore';

type Msg = { role: 'user' | 'bot'; text: string };

const inferPriority = (text: string): 'ORDER' | 'PAYMENT' | 'PRODUCT' | 'GENERAL' => {
  const s = text.toLowerCase();
  if (/(ord-|order|tracking|ship|deliver|cancel)/.test(s)) return 'ORDER';
  if (/(pay|payment|bakong|visa|master|refund|card)/.test(s)) return 'PAYMENT';
  if (/(product|stock|color|size|variant|price)/.test(s)) return 'PRODUCT';
  return 'GENERAL';
};

export default function SupportChatWidget() {
  const { user } = useAuthStore();
  const { language } = useLanguageStore();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'bot',
      text:
        language === 'km'
          ? 'សួស្តី! តើខ្ញុំអាចជួយអ្វីបាន?'
          : language === 'zh'
            ? '您好！我可以帮您什么？'
            : 'Hi! How can I help you?',
    },
  ]);
  const [fallbackStreak, setFallbackStreak] = useState(0);
  const talkToHumanLabel =
    language === 'km' ? 'ជជែកជាមួយមនុស្សពិត' : language === 'zh' ? '转人工客服' : 'Talk to human';

  const humanHandoffText = useMemo(
    () =>
      language === 'km'
        ? `ខ្ញុំមិនច្បាស់ទេ។ សូមចុច ${talkToHumanLabel} ដើម្បីផ្ញើសារ​ទៅ admin support inbox។`
        : language === 'zh'
          ? `我不太确定。请点击${talkToHumanLabel}把问题发送到管理员支持收件箱。`
          : `I am not fully sure. Tap ${talkToHumanLabel} to send this to admin support inbox.`,
    [language, talkToHumanLabel]
  );

  const logUnanswered = async (question: string) => {
    try {
      await supportApi.createInquiry({
        name: user?.name || 'Guest User',
        phone: user?.phone || 'N/A',
        question,
        priority: inferPriority(question),
        transcript: messages.slice(-8).map((m) => `${m.role}: ${m.text}`).join('\n'),
      });
    } catch {
      // silent
    }
  };

  const send = async (inputText?: string) => {
    const text = (inputText ?? input).trim();
    if (!text) return;
    const next: Msg[] = [...messages, { role: 'user', text }];
    setMessages(next);
    setInput('');

    if (/ORD-[A-Z0-9-]+/i.test(text)) {
      const orderNo = text.match(/ORD-[A-Z0-9-]+/i)?.[0] || '';
      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          text:
            language === 'km'
              ? `ខ្ញុំបានរកឃើញលេខកម្មង់ ${orderNo}។ បើចង់ឲ្យ admin ពិនិត្យ សូមចុច ${talkToHumanLabel}។`
              : language === 'zh'
                ? `我识别到订单号 ${orderNo}。如需人工处理，请点击${talkToHumanLabel}。`
                : `I detected order number ${orderNo}. Tap ${talkToHumanLabel} for admin follow-up.`,
        },
      ]);
      setFallbackStreak(0);
      return;
    }

    const generic = language === 'km' ? 'សូមពិពណ៌នាបន្ថែមបន្តិចទៀត។' : language === 'zh' ? '请再详细说明一点。' : 'Please share a bit more detail.';
    setMessages((prev) => [...prev, { role: 'bot', text: generic }]);
    const streak = fallbackStreak + 1;
    setFallbackStreak(streak);
    if (streak >= 2) {
      setMessages((prev) => [...prev, { role: 'bot', text: humanHandoffText }]);
      await logUnanswered(text);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full bg-primary-600 text-white shadow-lg flex items-center justify-center"
      >
        <MessageCircle className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 w-[340px] max-w-[calc(100vw-24px)] card p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="font-semibold text-sm">
          {language === 'km' ? 'ជំនួយ' : language === 'zh' ? '客服支持' : 'Support'}
        </p>
        <button type="button" onClick={() => setOpen(false)} className="text-gray-500">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="h-64 overflow-y-auto border rounded-lg p-2 space-y-2 bg-gray-50 dark:bg-surface-900">
        {messages.map((m, i) => (
          <div key={i} className={`text-xs p-2 rounded-lg ${m.role === 'user' ? 'bg-primary-600 text-white ml-10' : 'bg-white dark:bg-surface-800 mr-10'}`}>
            {m.text}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => logUnanswered(input || talkToHumanLabel)}
          className="btn-secondary text-xs px-2"
        >
          {talkToHumanLabel}
        </button>
      </div>
      <div className="mt-2 flex gap-2">
        <input
          className="input text-xs flex-1 h-9"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
          placeholder={language === 'km' ? 'សរសេរសារ...' : language === 'zh' ? '输入消息...' : 'Type message...'}
        />
        <button type="button" onClick={() => send()} className="btn-primary h-9 px-3">
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
