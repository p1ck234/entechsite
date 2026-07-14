import { Pool } from 'pg';
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

/** Telegram chat_id обработчиков публичной очереди */
export const getPublicAgentTelegramChatIds = async (pool: Pool): Promise<string[]> => {
  const result = await pool.query(
    `SELECT DISTINCT e.telegram_id
     FROM support_agents a
     JOIN users u ON u.id = a.user_id
     JOIN employees e ON LOWER(e.email) = LOWER(u.email)
     WHERE a.is_active = true
       AND e.telegram_id IS NOT NULL
       AND e.is_active = true
       AND e.status = 'APPROVED'`
  );

  return result.rows.map((row) => String(row.telegram_id));
};

export const notifySupportAgents = async (
  pool: Pool,
  queue: SupportQueue,
  text: string
): Promise<void> => {
  if (queue !== 'public') {
    return;
  }

  const chatIds = await getPublicAgentTelegramChatIds(pool);
  await Promise.all(chatIds.map((chatId) => sendTelegramMessage(queue, chatId, text)));
};

export const notifyTicketReplyParties = async (params: {
  pool: Pool;
  queue: SupportQueue;
  ticketId: number;
  subject: string;
  replyPreview: string;
  authorName: string;
  isAgent: boolean;
  requesterChatId?: number | string | null;
  requesterUserId: string | number;
  authorUserId: string | number;
}): Promise<void> => {
  const {
    pool,
    queue,
    ticketId,
    subject,
    replyPreview,
    authorName,
    isAgent,
    requesterChatId,
    requesterUserId,
    authorUserId,
  } = params;

  const preview = replyPreview.slice(0, 280);
  const text =
    `Заявка #${ticketId}: ${subject}\n` +
    `Ответ от ${authorName}${isAgent ? ' (поддержка)' : ''}:\n` +
    preview;

  if (isAgent) {
    if (requesterChatId && String(authorUserId) !== String(requesterUserId)) {
      await sendTelegramMessage(queue, requesterChatId, text);
    }
  } else if (queue === 'public') {
    await notifySupportAgents(pool, queue, text);
  }
};
