import type { Request, Response } from "express";
import { timingSafeEqual } from "crypto";
import { consumeTelegramLinkCode } from "./db";

type TelegramUpdate = {
  message?: {
    chat?: { id?: number; type?: string };
    from?: { id?: number };
    text?: string;
  };
};

function safeSecretEqual(received: string | undefined, expected: string): boolean {
  if (!received) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Telegram bot is not configured");
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Telegram message delivery failed");
}

export async function handleTelegramWebhook(req: Request, res: Response): Promise<void> {
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!webhookSecret || !safeSecretEqual(req.header("x-telegram-bot-api-secret-token"), webhookSecret)) {
    res.sendStatus(401);
    return;
  }

  const update = req.body as TelegramUpdate;
  const message = update?.message;
  const chatId = message?.chat?.id;
  const telegramUserId = message?.from?.id;
  const text = message?.text?.trim() ?? "";

  if (!message || !Number.isSafeInteger(chatId) || !Number.isSafeInteger(telegramUserId) || message.chat?.type !== "private") {
    res.sendStatus(200);
    return;
  }

  // Acknowledge quickly; Telegram retries webhook deliveries that time out.
  res.sendStatus(200);

  try {
    if (text.startsWith("/start")) {
      const code = text.split(/\s+/, 2)[1];
      if (!code || code.length < 20 || code.length > 100) {
        await sendTelegramMessage(chatId!, "أهلًا بك في مساعد Clientora. لربط حسابك، أنشئ رمز الربط من داخل حسابك في Clientora ثم أرسل /start متبوعًا بالرمز.");
        return;
      }
      const result = await consumeTelegramLinkCode(code, String(telegramUserId));
      await sendTelegramMessage(chatId!, result.success
        ? "تم ربط حساب Clientora بنجاح. أستطيع مساعدتك في شرح استخدام المنصة وإرشادك للدعم الفني. لن أطلب كلمة مرورك أو بيانات عملائك."
        : "رمز الربط غير صالح أو منتهي أو مستخدم بالفعل. أنشئ رمزًا جديدًا من داخل Clientora وحاول مرة أخرى.");
      return;
    }

    await sendTelegramMessage(chatId!, "أنا مساعد دعم Clientora. يمكنني إرشادك إلى كيفية استخدام المنصة وحل المشكلات العامة. لا ترسل كلمات المرور أو بيانات العملاء هنا. ابدأ بربط حسابك عبر /start ورمز الربط من لوحة Clientora.");
  } catch {
    // Do not log request bodies, link codes, Telegram IDs, or bot credentials.
  }
}
