import express, { Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { pool } from '../db/pool';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { ensureSupportSchema } from '../utils/ensure-schema';
import {
  canAgentPublicQueue,
  canAccessShadowQueue,
  canCreateInQueue,
  canTransitionTicket,
  canViewTicket,
  getSupportMeFlags,
} from '../utils/support-permissions';
import {
  SupportPriority,
  SupportQueue,
  SupportStatus,
  computeSlaDeadlines,
  isSupportPriority,
  isWithinSla,
  msBetween,
} from '../utils/support-sla';
import { canTransitionStatus } from '../utils/support-ticket-rules';
import {
  notifySupportAgents,
  notifyTelegramStatusChange,
  notifyTicketReplyParties,
} from '../utils/support-notify';
import {
  closeTodoistTask,
  syncCompletedTicketsFromTodoist,
  syncTicketToTodoist,
} from '../utils/support-todoist';

const router = express.Router();

router.use(async (_req, _res, next) => {
  try {
    await ensureSupportSchema(pool);
    next();
  } catch (error) {
    next(error);
  }
});

const mapTicket = (row: any) => ({
  id: String(row.id),
  queue: row.queue as SupportQueue,
  requesterUserId: String(row.requester_user_id),
  requesterName: row.requester_name,
  requesterEmail: row.requester_email,
  subject: row.subject,
  body: row.body,
  category: row.category,
  priority: row.priority as SupportPriority,
  status: row.status as SupportStatus,
  assigneeUserId: row.assignee_user_id ? String(row.assignee_user_id) : null,
  telegramChatId: row.telegram_chat_id ? String(row.telegram_chat_id) : null,
  attachmentUrl: row.attachment_url || null,
  resolutionNote: row.resolution_note || null,
  createdAt: row.created_at,
  acknowledgedAt: row.acknowledged_at,
  acknowledgedBy: row.acknowledged_by ? String(row.acknowledged_by) : null,
  startedAt: row.started_at,
  resolvedAt: row.resolved_at,
  resolvedBy: row.resolved_by ? String(row.resolved_by) : null,
  responseDueAt: row.response_due_at,
  resolveDueAt: row.resolve_due_at,
  updatedAt: row.updated_at,
  todoistTaskId: row.todoist_task_id ? String(row.todoist_task_id) : null,
  responseSlaMet: isWithinSla(row.response_due_at, row.acknowledged_at),
  resolveSlaMet: isWithinSla(row.resolve_due_at, row.resolved_at),
  firstResponseMs: msBetween(row.created_at, row.acknowledged_at),
  resolveMs: msBetween(row.created_at, row.resolved_at),
});

const mapEvent = (row: any) => ({
  id: String(row.id),
  ticketId: String(row.ticket_id),
  actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
  eventType: row.event_type,
  fromStatus: row.from_status,
  toStatus: row.to_status,
  note: row.note,
  createdAt: row.created_at,
});

const mapReply = (row: any) => ({
  id: String(row.id),
  ticketId: String(row.ticket_id),
  authorUserId: String(row.author_user_id),
  authorName: row.author_name,
  isAgent: Boolean(row.is_agent),
  body: row.body,
  createdAt: row.created_at,
});

const loadRequesterProfile = async (userId: string) => {
  const result = await pool.query(
    `SELECT u.id, u.email,
            e.first_name, e.last_name, e.middle_name, e.telegram_id
     FROM users u
     LEFT JOIN employees e ON LOWER(e.email) = LOWER(u.email)
     WHERE u.id = $1
     LIMIT 1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  const name = [row.last_name, row.first_name, row.middle_name].filter(Boolean).join(' ') || row.email;
  return {
    userId: String(row.id),
    email: row.email as string,
    name,
    telegramId: row.telegram_id as number | null,
  };
};

const insertEvent = async (
  ticketId: number,
  actorUserId: string | null,
  eventType: string,
  fromStatus: string | null,
  toStatus: string | null,
  note?: string | null
) => {
  await pool.query(
    `INSERT INTO support_ticket_events
      (ticket_id, actor_user_id, event_type, from_status, to_status, note)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [ticketId, actorUserId, eventType, fromStatus, toStatus, note || null]
  );
};

router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const flags = await getSupportMeFlags(pool, req.user);
    return res.json(flags);
  } catch (error) {
    console.error('Support me error:', error);
    return res.status(500).json({ message: 'Не удалось получить права поддержки' });
  }
});

router.post(
  '/todoist-sync',
  authenticateToken,
  requireAdmin,
  async (_req: AuthRequest, res: Response) => {
    try {
      const result = await syncCompletedTicketsFromTodoist(pool);
      return res.json({ message: 'Синхронизация Todoist выполнена', ...result });
    } catch (error) {
      console.error('Todoist sync endpoint error:', error);
      return res.status(500).json({ message: 'Не удалось синхронизировать Todoist' });
    }
  }
);

router.get(
  '/kpi',
  authenticateToken,
  query('queue').optional().isIn(['public', 'shadow']),
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const requestedQueue = (req.query.queue as SupportQueue | undefined) || 'public';

      if (requestedQueue === 'shadow') {
        const ok = await canAccessShadowQueue(pool, req.user);
        if (!ok) {
          return res.status(404).json({ message: 'Not found' });
        }
      } else {
        const ok = await canAgentPublicQueue(pool, req.user);
        if (!ok) {
          return res.status(403).json({ message: 'Недостаточно прав для KPI' });
        }
      }

      const stats = await pool.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'new')::int AS new_count,
           COUNT(*) FILTER (WHERE status = 'acknowledged')::int AS acknowledged_count,
           COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress_count,
           COUNT(*) FILTER (WHERE status = 'done')::int AS done_count,
           AVG(EXTRACT(EPOCH FROM (acknowledged_at - created_at)) * 1000)
             FILTER (WHERE acknowledged_at IS NOT NULL) AS avg_first_response_ms,
           AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) * 1000)
             FILTER (WHERE resolved_at IS NOT NULL) AS avg_resolve_ms,
           COUNT(*) FILTER (
             WHERE acknowledged_at IS NOT NULL AND acknowledged_at <= response_due_at
           )::int AS response_sla_met,
           COUNT(*) FILTER (WHERE acknowledged_at IS NOT NULL)::int AS response_sla_total,
           COUNT(*) FILTER (
             WHERE resolved_at IS NOT NULL AND resolved_at <= resolve_due_at
           )::int AS resolve_sla_met,
           COUNT(*) FILTER (WHERE resolved_at IS NOT NULL)::int AS resolve_sla_total
         FROM support_tickets
         WHERE queue = $1`,
        [requestedQueue]
      );

      const byPriority = await pool.query(
        `SELECT priority,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'done')::int AS done_count,
                AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) * 1000)
                  FILTER (WHERE resolved_at IS NOT NULL) AS avg_resolve_ms
         FROM support_tickets
         WHERE queue = $1
         GROUP BY priority
         ORDER BY priority`,
        [requestedQueue]
      );

      const row = stats.rows[0];
      const responseTotal = row.response_sla_total || 0;
      const resolveTotal = row.resolve_sla_total || 0;

      return res.json({
        queue: requestedQueue,
        total: row.total,
        byStatus: {
          new: row.new_count,
          acknowledged: row.acknowledged_count,
          inProgress: row.in_progress_count,
          done: row.done_count,
        },
        avgFirstResponseMs: row.avg_first_response_ms ? Number(row.avg_first_response_ms) : null,
        avgResolveMs: row.avg_resolve_ms ? Number(row.avg_resolve_ms) : null,
        responseSlaCompliance:
          responseTotal > 0 ? Number(row.response_sla_met) / responseTotal : null,
        resolveSlaCompliance: resolveTotal > 0 ? Number(row.resolve_sla_met) / resolveTotal : null,
        byPriority: byPriority.rows.map((item) => ({
          priority: item.priority,
          total: item.total,
          doneCount: item.done_count,
          avgResolveMs: item.avg_resolve_ms ? Number(item.avg_resolve_ms) : null,
        })),
      });
    } catch (error) {
      console.error('Support KPI error:', error);
      return res.status(500).json({ message: 'Не удалось посчитать KPI' });
    }
  }
);

router.get(
  '/agents',
  authenticateToken,
  requireAdmin,
  async (_req: AuthRequest, res: Response) => {
    try {
      const result = await pool.query(
        `SELECT a.id, a.user_id, a.is_active, a.created_at,
                u.email,
                e.first_name, e.last_name, e.middle_name
         FROM support_agents a
         JOIN users u ON u.id = a.user_id
         LEFT JOIN employees e ON LOWER(e.email) = LOWER(u.email)
         ORDER BY a.created_at DESC`
      );

      return res.json({
        agents: result.rows.map((row) => ({
          id: String(row.id),
          userId: String(row.user_id),
          email: row.email,
          name: [row.last_name, row.first_name, row.middle_name].filter(Boolean).join(' ') || row.email,
          isActive: row.is_active,
          createdAt: row.created_at,
        })),
      });
    } catch (error) {
      console.error('Support agents list error:', error);
      return res.status(500).json({ message: 'Не удалось загрузить агентов' });
    }
  }
);

router.post(
  '/agents',
  authenticateToken,
  requireAdmin,
  body('userId').notEmpty(),
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = Number(req.body.userId);
      const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Пользователь не найден' });
      }

      const result = await pool.query(
        `INSERT INTO support_agents (user_id, is_active)
         VALUES ($1, true)
         ON CONFLICT (user_id) DO UPDATE SET is_active = true
         RETURNING id, user_id, is_active, created_at`,
        [userId]
      );

      return res.status(201).json({
        message: 'Агент назначения',
        agent: {
          id: String(result.rows[0].id),
          userId: String(result.rows[0].user_id),
          isActive: result.rows[0].is_active,
          createdAt: result.rows[0].created_at,
        },
      });
    } catch (error) {
      console.error('Support agent create error:', error);
      return res.status(500).json({ message: 'Не удалось назначить агента' });
    }
  }
);

router.delete(
  '/agents/:userId',
  authenticateToken,
  requireAdmin,
  param('userId').isInt(),
  async (req: AuthRequest, res: Response) => {
    try {
      await pool.query(
        `UPDATE support_agents SET is_active = false WHERE user_id = $1`,
        [Number(req.params.userId)]
      );
      return res.json({ message: 'Агент отключён' });
    } catch (error) {
      console.error('Support agent delete error:', error);
      return res.status(500).json({ message: 'Не удалось отключить агента' });
    }
  }
);

router.get(
  '/',
  authenticateToken,
  query('scope').optional().isIn(['mine', 'queue']),
  query('queue').optional().isIn(['public', 'shadow']),
  query('status').optional().isIn(['new', 'acknowledged', 'in_progress', 'done']),
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const scope = (req.query.scope as string) || 'mine';
      const queue = (req.query.queue as SupportQueue | undefined) || 'public';
      const status = req.query.status as SupportStatus | undefined;

      if (scope === 'queue') {
        if (queue === 'shadow') {
          const ok = await canAccessShadowQueue(pool, req.user);
          if (!ok) {
            return res.status(404).json({ message: 'Not found' });
          }
        } else {
          const ok = await canAgentPublicQueue(pool, req.user);
          if (!ok) {
            return res.status(403).json({ message: 'Недостаточно прав' });
          }
        }

        const params: any[] = [queue];
        let sql = `SELECT * FROM support_tickets WHERE queue = $1`;
        if (status) {
          params.push(status);
          sql += ` AND status = $2`;
        }
        sql += ` ORDER BY created_at DESC LIMIT 200`;

        const result = await pool.query(sql, params);
        return res.json({ tickets: result.rows.map(mapTicket) });
      }

      // mine — публичные свои; shadow свои только если оператор (иначе 404 при явной shadow)
      if (queue === 'shadow') {
        const ok = await canAccessShadowQueue(pool, req.user);
        if (!ok) {
          return res.status(404).json({ message: 'Not found' });
        }
      }

      const params: any[] = [req.user!.id, queue];
      let sql = `SELECT * FROM support_tickets
                 WHERE requester_user_id = $1 AND queue = $2`;
      if (status) {
        params.push(status);
        sql += ` AND status = $3`;
      }
      sql += ` ORDER BY created_at DESC LIMIT 200`;

      const result = await pool.query(sql, params);
      return res.json({ tickets: result.rows.map(mapTicket) });
    } catch (error) {
      console.error('Support tickets list error:', error);
      return res.status(500).json({ message: 'Не удалось загрузить заявки' });
    }
  }
);

router.get(
  '/:id',
  authenticateToken,
  param('id').isInt(),
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await pool.query(`SELECT * FROM support_tickets WHERE id = $1`, [
        Number(req.params.id),
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Заявка не найдена' });
      }

      const ticket = result.rows[0];
      const access = await canViewTicket(pool, req.user, ticket);
      if (!access.allowed) {
        return res.status(access.notFound ? 404 : 403).json({
          message: access.notFound ? 'Заявка не найдена' : 'Недостаточно прав',
        });
      }

      const [events, replies] = await Promise.all([
        pool.query(
          `SELECT * FROM support_ticket_events WHERE ticket_id = $1 ORDER BY created_at ASC`,
          [ticket.id]
        ),
        pool.query(
          `SELECT * FROM support_ticket_replies WHERE ticket_id = $1 ORDER BY created_at ASC`,
          [ticket.id]
        ),
      ]);

      return res.json({
        ticket: mapTicket(ticket),
        events: events.rows.map(mapEvent),
        replies: replies.rows.map(mapReply),
      });
    } catch (error) {
      console.error('Support ticket get error:', error);
      return res.status(500).json({ message: 'Не удалось загрузить заявку' });
    }
  }
);

router.post(
  '/:id/replies',
  authenticateToken,
  param('id').isInt(),
  body('body').trim().isLength({ min: 1, max: 5000 }),
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const ticketId = Number(req.params.id);
      const result = await pool.query(`SELECT * FROM support_tickets WHERE id = $1`, [ticketId]);
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Заявка не найдена' });
      }

      const ticket = result.rows[0];
      const access = await canViewTicket(pool, req.user, ticket);
      if (!access.allowed) {
        return res.status(access.notFound ? 404 : 403).json({
          message: access.notFound ? 'Заявка не найдена' : 'Недостаточно прав',
        });
      }

      if (ticket.status === 'done') {
        return res.status(400).json({ message: 'Нельзя отвечать в закрытую заявку' });
      }

      const profile = await loadRequesterProfile(req.user!.id);
      const isAgent =
        ticket.queue === 'shadow'
          ? await canAccessShadowQueue(pool, req.user)
          : await canAgentPublicQueue(pool, req.user);

      const inserted = await pool.query(
        `INSERT INTO support_ticket_replies
          (ticket_id, author_user_id, author_name, is_agent, body)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          ticketId,
          req.user!.id,
          profile?.name || req.user!.email,
          isAgent,
          req.body.body.trim(),
        ]
      );

      await insertEvent(
        ticketId,
        req.user!.id,
        'reply',
        ticket.status,
        ticket.status,
        req.body.body.trim().slice(0, 200)
      );

      void notifyTicketReplyParties({
        pool,
        queue: ticket.queue,
        ticketId: ticket.id,
        subject: ticket.subject,
        replyPreview: req.body.body.trim(),
        authorName: profile?.name || req.user!.email,
        isAgent,
        requesterChatId: ticket.telegram_chat_id,
        requesterUserId: ticket.requester_user_id,
        authorUserId: req.user!.id,
      });

      return res.status(201).json({
        message: 'Ответ добавлен',
        reply: mapReply(inserted.rows[0]),
      });
    } catch (error) {
      console.error('Support reply error:', error);
      return res.status(500).json({ message: 'Не удалось добавить ответ' });
    }
  }
);

router.post(
  '/',
  authenticateToken,
  body('subject').trim().isLength({ min: 3, max: 255 }),
  body('body').trim().isLength({ min: 3, max: 10000 }),
  body('category')
    .optional()
    .trim()
    .isIn([
      'printer',
      'computer',
      'network',
      'email',
      'access',
      'software',
      '1c',
      'phone',
      'other',
      'telegram',
      'hardware',
    ]),
  body('priority').optional().isIn(['P1', 'P2', 'P3']),
  body('queue').optional().isIn(['public', 'shadow']),
  body('attachmentUrl').optional().isString().isLength({ max: 500 }),
  body('telegramChatId').optional(),
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const queue = ((req.body.queue as SupportQueue) || 'public') as SupportQueue;
      const canCreate = await canCreateInQueue(pool, req.user, queue);
      if (!canCreate) {
        return res
          .status(queue === 'shadow' ? 404 : 403)
          .json({ message: queue === 'shadow' ? 'Not found' : 'Недостаточно прав' });
      }

      const profile = await loadRequesterProfile(req.user!.id);
      if (!profile) {
        return res.status(400).json({ message: 'Профиль пользователя не найден' });
      }

      const priority = (isSupportPriority(req.body.priority) ? req.body.priority : 'P3') as SupportPriority;
      const createdAt = new Date();
      const deadlines = computeSlaDeadlines(priority, createdAt);
      const telegramChatId =
        req.body.telegramChatId != null
          ? Number(req.body.telegramChatId)
          : profile.telegramId;

      const result = await pool.query(
        `INSERT INTO support_tickets (
           queue, requester_user_id, requester_name, requester_email,
           subject, body, category, priority, status,
           telegram_chat_id, attachment_url,
           created_at, response_due_at, resolve_due_at, updated_at
         ) VALUES (
           $1, $2, $3, $4,
           $5, $6, $7, $8, 'new',
           $9, $10,
           $11, $12, $13, $11
         ) RETURNING *`,
        [
          queue,
          req.user!.id,
          profile.name,
          profile.email,
          req.body.subject.trim(),
          req.body.body.trim(),
          (req.body.category || 'other').trim(),
          priority,
          telegramChatId || null,
          req.body.attachmentUrl || null,
          createdAt,
          deadlines.responseDueAt,
          deadlines.resolveDueAt,
        ]
      );

      const ticket = result.rows[0];
      await insertEvent(ticket.id, req.user!.id, 'created', null, 'new', null);

      // Публичные заявки → Todoist + TG обработчикам
      if (ticket.queue === 'public') {
        try {
          await syncTicketToTodoist(pool, ticket);
        } catch {
          console.error('Todoist sync on create failed');
        }

        void notifySupportAgents(
          pool,
          'public',
          `Новая заявка #${ticket.id}\n` +
            `${ticket.subject}\n` +
            `От: ${ticket.requester_name}\n` +
            `${String(ticket.body).slice(0, 240)}`
        );

        const refreshed = await pool.query(`SELECT * FROM support_tickets WHERE id = $1`, [
          ticket.id,
        ]);
        if (refreshed.rows[0]) {
          return res.status(201).json({
            message: 'Заявка создана',
            ticket: mapTicket(refreshed.rows[0]),
          });
        }
      }

      return res.status(201).json({
        message: 'Заявка создана',
        ticket: mapTicket(ticket),
      });
    } catch (error) {
      console.error('Support ticket create error:', error);
      return res.status(500).json({ message: 'Не удалось создать заявку' });
    }
  }
);

const transitionHandler =
  (toStatus: SupportStatus) =>
  async (req: AuthRequest, res: Response) => {
    try {
      const ticketId = Number(req.params.id);
      const result = await pool.query(`SELECT * FROM support_tickets WHERE id = $1`, [ticketId]);
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Заявка не найдена' });
      }

      const ticket = result.rows[0];
      const access = await canTransitionTicket(pool, req.user, ticket.queue);
      if (!access.allowed) {
        return res.status(access.notFound ? 404 : 403).json({
          message: access.notFound ? 'Заявка не найдена' : 'Недостаточно прав',
        });
      }

      const check = canTransitionStatus(ticket.status, toStatus);
      if (!check.valid) {
        return res.status(400).json({ message: check.reason });
      }

      const now = new Date();
      let updated;

      if (toStatus === 'acknowledged') {
        updated = await pool.query(
          `UPDATE support_tickets SET
             status = 'acknowledged',
             acknowledged_at = $2,
             acknowledged_by = $3,
             assignee_user_id = COALESCE(assignee_user_id, $3),
             updated_at = $2
           WHERE id = $1
           RETURNING *`,
          [ticketId, now, req.user!.id]
        );
      } else if (toStatus === 'in_progress') {
        updated = await pool.query(
          `UPDATE support_tickets SET
             status = 'in_progress',
             started_at = $2,
             assignee_user_id = $3,
             updated_at = $2
           WHERE id = $1
           RETURNING *`,
          [ticketId, now, req.user!.id]
        );
      } else {
        updated = await pool.query(
          `UPDATE support_tickets SET
             status = 'done',
             resolved_at = $2,
             resolved_by = $3,
             resolution_note = $4,
             updated_at = $2
           WHERE id = $1
           RETURNING *`,
          [ticketId, now, req.user!.id, req.body?.note || null]
        );
      }

      const nextTicket = updated.rows[0];
      await insertEvent(
        ticketId,
        req.user!.id,
        `status_${toStatus}`,
        ticket.status,
        toStatus,
        req.body?.note || null
      );

      void notifyTelegramStatusChange({
        queue: nextTicket.queue,
        chatId: nextTicket.telegram_chat_id,
        ticketId: nextTicket.id,
        subject: nextTicket.subject,
        status: toStatus,
      });

      if (toStatus === 'done' && nextTicket.todoist_task_id) {
        void closeTodoistTask(String(nextTicket.todoist_task_id));
      }

      return res.json({
        message: 'Статус обновлён',
        ticket: mapTicket(nextTicket),
      });
    } catch (error) {
      console.error('Support transition error:', error);
      return res.status(500).json({ message: 'Не удалось обновить статус' });
    }
  };

router.post(
  '/:id/acknowledge',
  authenticateToken,
  param('id').isInt(),
  transitionHandler('acknowledged')
);

router.post(
  '/:id/start',
  authenticateToken,
  param('id').isInt(),
  transitionHandler('in_progress')
);

router.post(
  '/:id/resolve',
  authenticateToken,
  param('id').isInt(),
  body('note').optional().isString().isLength({ max: 5000 }),
  transitionHandler('done')
);

export default router;
