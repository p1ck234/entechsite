import { Pool } from 'pg';
import type { TicketFormatInput } from './support-ticket-format';

/** Собрать данные заявки + профиль заявителя для красивых уведомлений */
export const buildTicketFormatContext = async (
  pool: Pool,
  ticket: {
    id: number | string;
    subject: string;
    body: string;
    priority: string;
    category?: string | null;
    status?: string;
    queue?: string | null;
    requester_name?: string | null;
    requester_email?: string | null;
    requester_user_id?: number | string;
    created_at?: Date | string | null;
  }
): Promise<TicketFormatInput> => {
  let department: string | null = null;
  let position: string | null = null;
  let telegram: string | null = null;

  const email = ticket.requester_email;
  if (email) {
    const profile = await pool.query(
      `SELECT department, position, telegram, first_name, last_name, middle_name
       FROM employees
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [email]
    );
    if (profile.rows[0]) {
      department = profile.rows[0].department || null;
      position = profile.rows[0].position || null;
      telegram = profile.rows[0].telegram || null;
    }
  }

  if (!department && ticket.requester_user_id) {
    const byUser = await pool.query(
      `SELECT e.department, e.position, e.telegram
       FROM users u
       JOIN employees e ON LOWER(e.email) = LOWER(u.email)
       WHERE u.id = $1
       LIMIT 1`,
      [ticket.requester_user_id]
    );
    if (byUser.rows[0]) {
      department = department || byUser.rows[0].department || null;
      position = position || byUser.rows[0].position || null;
      telegram = telegram || byUser.rows[0].telegram || null;
    }
  }

  // Служебная очередь: отдел всегда «Тень», не HR-подразделение заявителя
  if (ticket.queue === 'shadow') {
    department = 'Тень';
  }

  return {
    id: ticket.id,
    subject: ticket.subject,
    body: ticket.body,
    priority: ticket.priority,
    category: ticket.category,
    status: ticket.status,
    queue: ticket.queue || null,
    requesterName: ticket.requester_name,
    requesterEmail: ticket.requester_email,
    department,
    position,
    telegram,
    createdAt: ticket.created_at || new Date(),
  };
};
