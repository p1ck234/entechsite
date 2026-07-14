import type { SupportQueue, SupportStatus } from './support-sla';
import { statusLabelRu } from './support-ticket-rules';
import { getSupportBotToken } from './support-bot-token';

const getBotToken = (queue: SupportQueue): string | null => getSupportBotToken(queue);

export const notifyTelegramStatusChange = async (params: {
  queue: SupportQueue;
  chatId: number | string | null | undefined;
  ticketId: number;
  subject: string;
  status: SupportStatus;
}): Promise<void> => {
  const { queue, chatId, ticketId, subject, status } = params;
  if (!chatId) {
    return;
  }

  const token = getBotToken(queue);
  if (!token) {
    return;
  }

  const text =
    `Заявка #${ticketId}\n` +
    `${subject}\n` +
    `Статус: ${statusLabelRu(status)}`;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    });
  } catch (error) {
    console.error('Support telegram notify failed');
  }
};

export const sendTelegramMessage = async (
  queue: SupportQueue,
  chatId: number | string,
  text: string,
  replyMarkup?: object
): Promise<void> => {
  const token = getBotToken(queue);
  if (!token) {
    return;
  }

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_markup: replyMarkup,
      }),
    });
  } catch (error) {
    console.error('Support telegram send failed');
  }
};

export const answerTelegramCallback = async (
  queue: SupportQueue,
  callbackQueryId: string,
  text?: string
): Promise<void> => {
  const token = getBotToken(queue);
  if (!token) {
    return;
  }

  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text || 'OK',
      }),
    });
  } catch {
    // ignore
  }
};
