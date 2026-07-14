import express, { Request, Response } from 'express';
import { pool } from '../db/pool';
import { ensureSupportSchema } from '../utils/ensure-schema';
import { canAccessShadowQueue } from '../utils/support-permissions';
import { SupportQueue, SupportPriority, computeSlaDeadlines } from '../utils/support-sla';
import { canTransitionStatus, statusLabelRu } from '../utils/support-ticket-rules';
import {
  answerTelegramCallback,
  notifySupportAgents,
  notifyTelegramStatusChange,
  sendTelegramMessage,
} from '../utils/support-notify';
import { getSupportBotSecret, getSupportBotToken } from '../utils/support-bot-token';
import { closeTodoistTask, syncTicketToTodoist } from '../utils/support-todoist';
import {
  SUPPORT_THEMES,
  buildTicketSubject,
  getPriorityLabel,
  getThemeLabel,
  isSupportThemeId,
  parsePriorityFromHumanText,
  type SupportThemeId,
} from '../utils/support-labels';
import { buildTicketFormatContext } from '../utils/support-ticket-context';
import {
  formatTelegramNewTicketHtml,
  formatTicketCode,
} from '../utils/support-ticket-format';

const router = express.Router();

type DraftState = {
  step: 'theme' | 'body' | 'priority';
  themeId?: SupportThemeId;
  body?: string;
};

const themesHelpText = () => 'Выберите тему кнопкой ниже:';

const priorityHelpText =
  'Насколько срочно? Нажмите кнопку ниже\n' +
  '(или напишите: критично / важно / обычная)';

const themeKeyboard = () => ({
  inline_keyboard: SUPPORT_THEMES.map((theme) => [
    { text: theme.label, callback_data: `theme:${theme.id}` },
  ]),
});

const priorityKeyboard = () => ({
  inline_keyboard: [
    [{ text: '🔴 Критично — работа встала', callback_data: 'priority:P1' }],
    [{ text: '🟡 Важно — сильно мешает', callback_data: 'priority:P2' }],
    [{ text: '🟢 Обычная — можно подождать', callback_data: 'priority:P3' }],
  ],
});

const draftByChat = new Map<string, DraftState>();

const resolveThemeFromText = (text: string): SupportThemeId | null => {
  const asNumber = Number(text.trim());
  if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= SUPPORT_THEMES.length) {
    return SUPPORT_THEMES[asNumber - 1].id;
  }
  if (isSupportThemeId(text.trim().toLowerCase())) {
    return text.trim().toLowerCase() as SupportThemeId;
  }
  const byLabel = SUPPORT_THEMES.find(
    (theme) => theme.label.toLowerCase() === text.trim().toLowerCase()
  );
  return byLabel?.id || null;
};

const getExpectedToken = (queue: SupportQueue): string | null => getSupportBotToken(queue);

const findUserByTelegram = async (telegramId: number, username?: string | null) => {
  const byId = await pool.query(
    `SELECT u.id, u.email, e.first_name, e.last_name, e.middle_name, e.telegram_id
     FROM employees e
     JOIN users u ON LOWER(u.email) = LOWER(e.email)
     WHERE e.telegram_id = $1 AND e.is_active = true AND e.status = 'APPROVED'
     LIMIT 1`,
    [telegramId]
  );

  if (byId.rows.length > 0) {
    return byId.rows[0];
  }

  if (!username) {
    return null;
  }

  const normalized = username.replace(/^@/, '').toLowerCase();
  const byUsername = await pool.query(
    `SELECT u.id, u.email, e.first_name, e.last_name, e.middle_name, e.telegram_id
     FROM employees e
     JOIN users u ON LOWER(u.email) = LOWER(e.email)
     WHERE LOWER(REPLACE(e.telegram, '@', '')) = $1
       AND e.is_active = true AND e.status = 'APPROVED'
     LIMIT 1`,
    [normalized]
  );

  return byUsername.rows[0] || null;
};

const fullName = (row: any) =>
  [row.last_name, row.first_name, row.middle_name].filter(Boolean).join(' ') || row.email;

const createTicketFromBot = async (params: {
  queue: SupportQueue;
  user: any;
  chatId: number;
  themeId: SupportThemeId;
  body: string;
  priority: SupportPriority;
}) => {
  const createdAt = new Date();
  const deadlines = computeSlaDeadlines(params.priority, createdAt);
  const subject = buildTicketSubject(params.themeId);
  const result = await pool.query(
    `INSERT INTO support_tickets (
       queue, requester_user_id, requester_name, requester_email,
       subject, body, category, priority, status,
       telegram_chat_id, created_at, response_due_at, resolve_due_at, updated_at
     ) VALUES (
       $1, $2, $3, $4,
       $5, $6, $7, $8, 'new',
       $9, $10, $11, $12, $10
     ) RETURNING id, subject, status`,
    [
      params.queue,
      params.user.id,
      fullName(params.user),
      params.user.email,
      subject,
      params.body,
      params.themeId,
      params.priority,
      params.chatId,
      createdAt,
      deadlines.responseDueAt,
      deadlines.resolveDueAt,
    ]
  );

  await pool.query(
    `INSERT INTO support_ticket_events
      (ticket_id, actor_user_id, event_type, from_status, to_status, note)
     VALUES ($1, $2, 'created', NULL, 'new', 'telegram')`,
    [result.rows[0].id, params.user.id]
  );

  const created = await pool.query(`SELECT * FROM support_tickets WHERE id = $1`, [
    result.rows[0].id,
  ]);
  const ticket = created.rows[0];
  if (ticket?.queue === 'public') {
    await syncTicketToTodoist(pool, ticket);
    void buildTicketFormatContext(pool, ticket).then((ctx) =>
      notifySupportAgents(pool, 'public', formatTelegramNewTicketHtml(ctx), 'HTML')
    );
  }

  return ticket || result.rows[0];
};

const applyTransition = async (
  ticketId: number,
  actorUserId: string,
  toStatus: 'acknowledged' | 'in_progress' | 'done'
) => {
  const result = await pool.query(`SELECT * FROM support_tickets WHERE id = $1`, [ticketId]);
  if (result.rows.length === 0) {
    return { error: 'Заявка не найдена' };
  }

  const ticket = result.rows[0];
  const check = canTransitionStatus(ticket.status, toStatus);
  if (!check.valid) {
    return { error: check.reason || 'Недопустимый переход' };
  }

  const now = new Date();
  let updated;
  if (toStatus === 'acknowledged') {
    updated = await pool.query(
      `UPDATE support_tickets SET
         status = 'acknowledged', acknowledged_at = $2, acknowledged_by = $3,
         assignee_user_id = COALESCE(assignee_user_id, $3), updated_at = $2
       WHERE id = $1 RETURNING *`,
      [ticketId, now, actorUserId]
    );
  } else if (toStatus === 'in_progress') {
    updated = await pool.query(
      `UPDATE support_tickets SET
         status = 'in_progress', started_at = $2, assignee_user_id = $3, updated_at = $2
       WHERE id = $1 RETURNING *`,
      [ticketId, now, actorUserId]
    );
  } else {
    updated = await pool.query(
      `UPDATE support_tickets SET
         status = 'done', resolved_at = $2, resolved_by = $3, updated_at = $2
       WHERE id = $1 RETURNING *`,
      [ticketId, now, actorUserId]
    );
  }

  await pool.query(
    `INSERT INTO support_ticket_events
      (ticket_id, actor_user_id, event_type, from_status, to_status, note)
     VALUES ($1, $2, $3, $4, $5, 'telegram')`,
    [ticketId, actorUserId, `status_${toStatus}`, ticket.status, toStatus]
  );

  const next = updated.rows[0];
  void notifyTelegramStatusChange({
    queue: next.queue,
    chatId: next.telegram_chat_id,
    ticketId: next.id,
    subject: next.subject,
    status: toStatus,
  });

  if (toStatus === 'done' && next.todoist_task_id) {
    void closeTodoistTask(String(next.todoist_task_id));
  }

  return { ticket: next };
};

router.post('/webhook/:queue', async (req: Request, res: Response) => {
  const queue = req.params.queue as SupportQueue;
  if (queue !== 'public' && queue !== 'shadow') {
    return res.status(404).json({ message: 'Not found' });
  }

  try {
    await ensureSupportSchema(pool);

    const expected = getExpectedToken(queue);
    const provided =
      (req.header('x-telegram-bot-api-secret-token') || req.query.token || '') as string;

    // Если задан SUPPORT_BOT_*_SECRET — требуем его; иначе принимаем только при наличии токена бота в env
    const secretEnv = getSupportBotSecret(queue);
    if (secretEnv && secretEnv !== provided) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    // Без токена всё ещё принимаем update (forward от telegram-bot),
    // но ответы в Telegram уйдут только если задан BOT_TOKEN / SUPPORT_BOT_*_TOKEN.
    if (!expected) {
      console.warn(`Support bot token missing for queue=${queue}; inbound accepted, replies may fail`);
    }

    const update = req.body || {};
    const message = update.message;
    const callback = update.callback_query;

    if (callback) {
      const from = callback.from;
      const data = String(callback.data || '');
      const chatId = callback.message?.chat?.id as number | undefined;
      const user = await findUserByTelegram(from.id, from.username);
      if (!user) {
        await answerTelegramCallback(queue, callback.id, 'Нет доступа');
        return res.json({ ok: true });
      }

      if (queue === 'shadow') {
        const ok = await canAccessShadowQueue(pool, {
          id: String(user.id),
          email: user.email,
          role: 'USER',
        });
        if (!ok) {
          await answerTelegramCallback(queue, callback.id, 'Нет доступа');
          return res.json({ ok: true });
        }
      }

      // Выбор темы при создании заявки
      const themeMatch = data.match(/^theme:([a-z0-9]+)$/i);
      if (themeMatch && chatId != null) {
        const themeId = themeMatch[1].toLowerCase();
        if (!isSupportThemeId(themeId)) {
          await answerTelegramCallback(queue, callback.id, 'Неизвестная тема');
          return res.json({ ok: true });
        }
        const draftKey = `${queue}:${chatId}`;
        const draft = draftByChat.get(draftKey);
        if (!draft || draft.step !== 'theme') {
          await answerTelegramCallback(queue, callback.id, 'Сначала нажмите «Новая заявка»');
          return res.json({ ok: true });
        }
        draft.themeId = themeId;
        draft.step = 'body';
        draftByChat.set(draftKey, draft);
        await answerTelegramCallback(queue, callback.id, getThemeLabel(themeId));
        await sendTelegramMessage(
          queue,
          chatId,
          `Тема: ${getThemeLabel(themeId)}\n\nОпишите проблему: что случилось и что уже пробовали.`
        );
        return res.json({ ok: true });
      }

      // Выбор срочности при создании заявки
      const priorityMatch = data.match(/^priority:(P[123])$/i);
      if (priorityMatch && chatId != null) {
        const priority = priorityMatch[1].toUpperCase() as SupportPriority;
        const draftKey = `${queue}:${chatId}`;
        const draft = draftByChat.get(draftKey);
        if (!draft || draft.step !== 'priority') {
          await answerTelegramCallback(queue, callback.id, 'Сначала опишите проблему');
          return res.json({ ok: true });
        }
        const ticket = await createTicketFromBot({
          queue,
          user,
          chatId,
          themeId: draft.themeId || 'other',
          body: draft.body || '—',
          priority,
        });
        draftByChat.delete(draftKey);
        await answerTelegramCallback(queue, callback.id, getPriorityLabel(priority));
        await sendTelegramMessage(
          queue,
          chatId,
          `✅ Заявка ${formatTicketCode(ticket.id)} создана\n` +
            `${ticket.subject}\n` +
            `Срочность: ${getPriorityLabel(priority)}\n` +
            `Статус: ${statusLabelRu('new')}`
        );
        return res.json({ ok: true });
      }

      const match = data.match(/^(ack|start|done):(\d+)$/);
      if (!match) {
        await answerTelegramCallback(queue, callback.id, 'Неизвестная команда');
        return res.json({ ok: true });
      }

      const action = match[1];
      const ticketId = Number(match[2]);
      const ticketRow = await pool.query(`SELECT queue FROM support_tickets WHERE id = $1`, [
        ticketId,
      ]);
      if (ticketRow.rows.length === 0 || ticketRow.rows[0].queue !== queue) {
        await answerTelegramCallback(queue, callback.id, 'Заявка не найдена');
        return res.json({ ok: true });
      }

      if (queue === 'public') {
        const agent = await pool.query(
          `SELECT 1 FROM support_agents WHERE user_id = $1 AND is_active = true LIMIT 1`,
          [user.id]
        );
        if (agent.rows.length === 0) {
          await answerTelegramCallback(queue, callback.id, 'Только для агентов');
          return res.json({ ok: true });
        }
      }

      const toStatus =
        action === 'ack' ? 'acknowledged' : action === 'start' ? 'in_progress' : 'done';
      const result = await applyTransition(ticketId, String(user.id), toStatus as any);
      await answerTelegramCallback(
        queue,
        callback.id,
        result.error || 'Обновлено'
      );
      if (chatId && !result.error) {
        await sendTelegramMessage(
          queue,
          chatId,
          `Заявка ${formatTicketCode(ticketId)}: ${statusLabelRu(toStatus as any)}`
        );
      }
      return res.json({ ok: true });
    }

    if (!message || !message.chat) {
      return res.json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = String(message.text || '').trim();
    const from = message.from;
    const user = await findUserByTelegram(from.id, from.username);

    if (!user) {
      await sendTelegramMessage(
        queue,
        chatId,
        'Сначала войдите в портал через Telegram и дождитесь одобрения профиля.'
      );
      return res.json({ ok: true });
    }

    if (queue === 'shadow') {
      const operatorOk = await canAccessShadowQueue(pool, {
        id: String(user.id),
        email: user.email,
        role: 'USER',
      });
      const hidden = await pool.query(
        `SELECT 1 FROM employees
         WHERE LOWER(email) = LOWER($1) AND COALESCE(is_hidden, false) = true
         LIMIT 1`,
        [user.email]
      );
      if (!operatorOk && hidden.rows.length === 0) {
        await sendTelegramMessage(queue, chatId, 'Нет доступа');
        return res.json({ ok: true });
      }
    }

    const draftKey = `${queue}:${chatId}`;

    const BUTTON_ALIASES: Record<string, string> = {
      '🆘 Новая заявка': '/new',
      '📋 Мои заявки': '/my',
      '❌ Отмена': '/cancel',
      'Новая заявка': '/new',
      'Мои заявки': '/my',
      Отмена: '/cancel',
      '📥 Очередь': '/queue',
      Очередь: '/queue',
    };
    const action = BUTTON_ALIASES[text] || text.split(/\s+/)[0]?.split('@')[0] || text;

    if (action === '/start' || action === '/help') {
      draftByChat.delete(draftKey);
      await sendTelegramMessage(
        queue,
        chatId,
        'Техподдержка:\n«Новая заявка» — создать обращение\n«Мои заявки» — ваши обращения\n«Отмена» — сбросить черновик\n\nОчередь для агентов — на портале в разделе «Поддержка».'
      );
      return res.json({ ok: true });
    }

    if (action === '/cancel') {
      draftByChat.delete(draftKey);
      await sendTelegramMessage(queue, chatId, 'Черновик отменён');
      return res.json({ ok: true });
    }

    if (action === '/my') {
      const tickets = await pool.query(
        `SELECT id, subject, status, priority, created_at
         FROM support_tickets
         WHERE requester_user_id = $1 AND queue = $2
         ORDER BY created_at DESC
         LIMIT 10`,
        [user.id, queue]
      );

      if (tickets.rows.length === 0) {
        await sendTelegramMessage(queue, chatId, 'Заявок пока нет');
        return res.json({ ok: true });
      }

      const lines = tickets.rows.map(
        (t) =>
          `${formatTicketCode(t.id)} · ${getPriorityLabel(t.priority)} · ${statusLabelRu(t.status)}\n${t.subject}`
      );
      await sendTelegramMessage(queue, chatId, lines.join('\n\n'));
      return res.json({ ok: true });
    }

    if (action === '/new') {
      draftByChat.set(draftKey, { step: 'theme' });
      await sendTelegramMessage(queue, chatId, themesHelpText(), themeKeyboard());
      return res.json({ ok: true });
    }

    // Очередь агента: незакрытые заявки всех сотрудников (не «мои»).
    // Для обычных пользователей скрыта в UI бота; доступна агентам/ADMIN на портале или по /queue.
    if (action === '/queue') {
      let allowed = false;
      if (queue === 'shadow') {
        allowed = await canAccessShadowQueue(pool, {
          id: String(user.id),
          email: user.email,
          role: 'USER',
        });
      } else {
        const agent = await pool.query(
          `SELECT 1 FROM support_agents WHERE user_id = $1 AND is_active = true LIMIT 1`,
          [user.id]
        );
        allowed = agent.rows.length > 0;
      }

      if (!allowed) {
        await sendTelegramMessage(queue, chatId, 'Недостаточно прав');
        return res.json({ ok: true });
      }

      const open = await pool.query(
        `SELECT id, subject, status, priority
         FROM support_tickets
         WHERE queue = $1 AND status <> 'done'
         ORDER BY created_at ASC
         LIMIT 10`,
        [queue]
      );

      if (open.rows.length === 0) {
        await sendTelegramMessage(queue, chatId, 'Открытых заявок нет');
        return res.json({ ok: true });
      }

      for (const t of open.rows) {
        const buttons = [];
        if (t.status === 'new') {
          buttons.push([{ text: 'Подтвердить', callback_data: `ack:${t.id}` }]);
        } else if (t.status === 'acknowledged') {
          buttons.push([{ text: 'В работу', callback_data: `start:${t.id}` }]);
        } else if (t.status === 'in_progress') {
          buttons.push([{ text: 'Готово', callback_data: `done:${t.id}` }]);
        }

        await sendTelegramMessage(
          queue,
          chatId,
          `${formatTicketCode(t.id)} · ${getPriorityLabel(t.priority)} · ${statusLabelRu(t.status)}\n${t.subject}`,
          buttons.length ? { inline_keyboard: buttons } : undefined
        );
      }
      return res.json({ ok: true });
    }

    const draft = draftByChat.get(draftKey);
    if (draft) {
      if (draft.step === 'theme') {
        const themeId = resolveThemeFromText(text);
        if (!themeId) {
          await sendTelegramMessage(
            queue,
            chatId,
            `Не понял тему — нажмите кнопку.\n\n${themesHelpText()}`,
            themeKeyboard()
          );
          return res.json({ ok: true });
        }

        draft.themeId = themeId;
        draft.step = 'body';
        draftByChat.set(draftKey, draft);
        await sendTelegramMessage(
          queue,
          chatId,
          `Тема: ${getThemeLabel(themeId)}\n\nОпишите проблему: что случилось и что уже пробовали.`
        );
        return res.json({ ok: true });
      }

      if (draft.step === 'body') {
        draft.body = text.slice(0, 10000);
        draft.step = 'priority';
        draftByChat.set(draftKey, draft);
        await sendTelegramMessage(queue, chatId, priorityHelpText, priorityKeyboard());
        return res.json({ ok: true });
      }

      if (draft.step === 'priority') {
        const priority = parsePriorityFromHumanText(text) || null;
        if (!priority) {
          await sendTelegramMessage(
            queue,
            chatId,
            `Не понял срочность — нажмите кнопку.\n\n${priorityHelpText}`,
            priorityKeyboard()
          );
          return res.json({ ok: true });
        }

        const ticket = await createTicketFromBot({
          queue,
          user,
          chatId,
          themeId: draft.themeId || 'other',
          body: draft.body || text,
          priority,
        });
        draftByChat.delete(draftKey);
        await sendTelegramMessage(
          queue,
          chatId,
          `✅ Заявка ${formatTicketCode(ticket.id)} создана\n` +
            `${ticket.subject}\n` +
            `Срочность: ${getPriorityLabel(priority)}\n` +
            `Статус: ${statusLabelRu('new')}`
        );
        return res.json({ ok: true });
      }
    }

    await sendTelegramMessage(
      queue,
      chatId,
      'Используйте кнопки: «Новая заявка» или «Мои заявки». Либо раздел «Поддержка» на портале.'
    );
    return res.json({ ok: true });
  } catch (error) {
    console.error('Support bot webhook error');
    return res.status(500).json({ message: 'Webhook error' });
  }
});

export default router;
