import nodemailer from 'nodemailer';
import twilio from 'twilio';
import axios from 'axios';

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

interface SmsPayload {
  to: string;
  text: string;
}

interface TelegramPayload {
  chatId: string;
  text: string;
  botToken?: string;
}

export const sendEmail = async (payload: EmailPayload): Promise<boolean> => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass || !from) {
    console.log(`[Invoice] SMTP not configured; skipped email to ${payload.to}`);
    return false;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });

  return true;
};

export const sendSms = async (payload: SmsPayload): Promise<boolean> => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = process.env.TWILIO_FROM_PHONE;

  if (!accountSid || !authToken || !fromPhone) {
    console.log(`[Invoice] Twilio not configured; skipped SMS to ${payload.to}`);
    return false;
  }

  const client = twilio(accountSid, authToken);

  await client.messages.create({
    from: fromPhone,
    to: payload.to,
    body: payload.text,
  });

  return true;
};

export const sendTelegramMessage = async (payload: TelegramPayload): Promise<boolean> => {
  const token = payload.botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !payload.chatId || !payload.text) {
    console.log('[Notify] Telegram not configured; skipped Telegram message');
    return false;
  }

  await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
    chat_id: payload.chatId,
    text: payload.text,
  });

  return true;
};
