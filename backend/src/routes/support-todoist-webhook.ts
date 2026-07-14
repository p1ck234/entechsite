import express, { Request, Response } from 'express';
import { pool } from '../db/pool';
import { ensureSupportSchema } from '../utils/ensure-schema';
import {
  parseTicketIdFromTodoist,
  resolveTicketFromTodoist,
} from '../utils/support-todoist';

const router = express.Router();

/**
 * Webhook Todoist (если настроен App Console):
 * event_name = item:completed
 * Без подписи App — принимаем и ищем entech-ticket:ID в description.
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    await ensureSupportSchema(pool);

    const eventName = req.body?.event_name || req.body?.event_name;
    const eventData = req.body?.event_data || req.body?.event_data || req.body;

    if (eventName && eventName !== 'item:completed') {
      return res.json({ ok: true, ignored: true });
    }

    let ticketId = parseTicketIdFromTodoist({
      description: eventData?.description,
      content: eventData?.content,
    });

    if (!ticketId && eventData?.id) {
      const byTask = await pool.query(
        `SELECT id FROM support_tickets WHERE todoist_task_id = $1 AND status <> 'done' LIMIT 1`,
        [String(eventData.id)]
      );
      if (byTask.rows[0]) {
        ticketId = Number(byTask.rows[0].id);
      }
    }

    if (!ticketId) {
      return res.json({ ok: true, matched: false });
    }

    await resolveTicketFromTodoist(pool, ticketId);
    return res.json({ ok: true, ticketId });
  } catch (error) {
    console.error('Todoist webhook error');
    return res.status(500).json({ message: 'Webhook error' });
  }
});

export default router;
