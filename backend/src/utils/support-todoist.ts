import { Pool } from 'pg';
import type { SupportPriority } from './support-sla';
import { notifyTelegramStatusChange } from './support-notify';
import {
  formatTodoistTaskContent,
  formatTodoistTaskDescription,
  type TicketFormatInput,
} from './support-ticket-format';
import { buildTicketFormatContext } from './support-ticket-context';

/** Todoist REST v2 отключён (410) — используем api/v1 */
const TODOIST_API = 'https://api.todoist.com/api/v1';
const DEFAULT_PROJECT_NAME = '💰 HQ/ЭГ/C';

let cachedProjectId: string | null | undefined;

export const getTodoistToken = (): string | null => {
  const token = (process.env.TODOIST_API_TOKEN || '').trim();
  return token || null;
};

const todoistPriority = (priority: SupportPriority): number => {
  if (priority === 'P1') return 4;
  if (priority === 'P2') return 3;
  return 2;
};

const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

export const resolveTodoistProjectId = async (): Promise<string | undefined> => {
  const fromEnv = (process.env.TODOIST_PROJECT_ID || '').trim();
  if (fromEnv) {
    return fromEnv;
  }

  if (cachedProjectId !== undefined) {
    return cachedProjectId || undefined;
  }

  const token = getTodoistToken();
  if (!token) {
    cachedProjectId = null;
    return undefined;
  }

  const wanted = (process.env.TODOIST_PROJECT_NAME || DEFAULT_PROJECT_NAME).trim();

  try {
    const response = await fetch(`${TODOIST_API}/projects`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      cachedProjectId = null;
      return undefined;
    }

    const data = (await response.json()) as { results?: Array<{ id: string; name: string }> } | Array<{ id: string; name: string }>;
    const list = Array.isArray(data) ? data : data.results || [];
    const exact = list.find((p) => p.name === wanted);
    const partial = list.find((p) => p.name.includes('HQ/ЭГ/C') && !p.name.includes('Операционная'));
    cachedProjectId = (exact || partial)?.id || null;
    if (cachedProjectId) {
      console.log(`✅ Todoist project: ${wanted} → ${cachedProjectId}`);
    }
    return cachedProjectId || undefined;
  } catch {
    cachedProjectId = null;
    return undefined;
  }
};

export const createTodoistTaskForTicket = async (
  ticket: TicketFormatInput
): Promise<string | null> => {
  const token = getTodoistToken();
  if (!token) {
    return null;
  }

  const projectId = await resolveTodoistProjectId();
  const content = formatTodoistTaskContent(ticket);
  const description = formatTodoistTaskDescription(ticket);

  try {
    const response = await fetch(`${TODOIST_API}/tasks`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        content,
        description,
        priority: todoistPriority(ticket.priority as SupportPriority),
        ...(projectId ? { project_id: projectId } : {}),
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('Todoist create task failed', response.status, errText.slice(0, 200));
      return null;
    }

    const data = (await response.json()) as { id?: string | number };
    return data.id != null ? String(data.id) : null;
  } catch (error) {
    console.error('Todoist create task error');
    return null;
  }
};

export const closeTodoistTask = async (taskId: string | null | undefined): Promise<boolean> => {
  const token = getTodoistToken();
  if (!token || !taskId) {
    return false;
  }

  try {
    const response = await fetch(`${TODOIST_API}/tasks/${taskId}/close`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.ok || response.status === 404;
  } catch {
    console.error('Todoist close task error');
    return false;
  }
};

export const isTodoistTaskCompleted = async (taskId: string): Promise<boolean | null> => {
  const token = getTodoistToken();
  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${TODOIST_API}/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 404) {
      return true;
    }
    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { is_completed?: boolean; checked?: boolean };
    return Boolean(data.is_completed || data.checked);
  } catch {
    return null;
  }
};

export const attachTodoistTaskId = async (
  pool: Pool,
  ticketId: number | string,
  taskId: string
): Promise<void> => {
  await pool.query(
    `UPDATE support_tickets SET todoist_task_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [ticketId, taskId]
  );
};

export const syncTicketToTodoist = async (
  pool: Pool,
  ticket: {
    id: number | string;
    subject: string;
    body: string;
    priority: SupportPriority | string;
    category?: string | null;
    status?: string;
    requester_name?: string | null;
    requester_email?: string | null;
    requester_user_id?: number | string;
    created_at?: Date | string | null;
    queue?: string;
    todoist_task_id?: string | null;
  }
): Promise<void> => {
  if (ticket.todoist_task_id) {
    return;
  }
  const context = await buildTicketFormatContext(pool, ticket);
  const taskId = await createTodoistTaskForTicket(context);
  if (taskId) {
    await attachTodoistTaskId(pool, ticket.id, taskId);
  }
};

export const resolveTicketFromTodoist = async (
  pool: Pool,
  ticketId: number
): Promise<boolean> => {
  const result = await pool.query(`SELECT * FROM support_tickets WHERE id = $1`, [ticketId]);
  if (result.rows.length === 0) {
    return false;
  }

  const ticket = result.rows[0];
  if (ticket.status === 'done') {
    return true;
  }

  const now = new Date();
  const updated = await pool.query(
    `UPDATE support_tickets SET
       status = 'done',
       acknowledged_at = COALESCE(acknowledged_at, $2),
       started_at = COALESCE(started_at, $2),
       resolved_at = $2,
       resolution_note = COALESCE(resolution_note, 'Закрыто в Todoist'),
       updated_at = $2
     WHERE id = $1 AND status <> 'done'
     RETURNING *`,
    [ticketId, now]
  );

  if (updated.rows.length === 0) {
    return true;
  }

  await pool.query(
    `INSERT INTO support_ticket_events
      (ticket_id, actor_user_id, event_type, from_status, to_status, note)
     VALUES ($1, NULL, 'status_done', $2, 'done', 'todoist')`,
    [ticketId, ticket.status]
  );

  const next = updated.rows[0];
  void notifyTelegramStatusChange({
    queue: next.queue,
    chatId: next.telegram_chat_id,
    ticketId: next.id,
    subject: next.subject,
    status: 'done',
  });

  return true;
};

export const parseTicketIdFromTodoist = (payload: {
  description?: string;
  content?: string;
}): number | null => {
  const blob = `${payload.description || ''}\n${payload.content || ''}`;
  const match = blob.match(/entech-ticket:(\d+)/i);
  return match ? Number(match[1]) : null;
};

export const syncCompletedTicketsFromTodoist = async (
  pool: Pool
): Promise<{ checked: number; closed: number }> => {
  if (!getTodoistToken()) {
    return { checked: 0, closed: 0 };
  }

  const open = await pool.query(
    `SELECT id, todoist_task_id FROM support_tickets
     WHERE status <> 'done' AND todoist_task_id IS NOT NULL
     ORDER BY updated_at ASC
     LIMIT 40`
  );

  let closed = 0;
  for (const row of open.rows) {
    const completed = await isTodoistTaskCompleted(String(row.todoist_task_id));
    if (completed === true) {
      const ok = await resolveTicketFromTodoist(pool, Number(row.id));
      if (ok) {
        closed += 1;
      }
    }
  }

  return { checked: open.rows.length, closed };
};

let pollTimer: NodeJS.Timeout | null = null;

export const startTodoistPolling = (pool: Pool): void => {
  if (!getTodoistToken() || pollTimer) {
    return;
  }

  const intervalMs = Number(process.env.TODOIST_SYNC_INTERVAL_MS || 60_000);
  console.log(`✅ Todoist sync: опрос каждые ${Math.round(intervalMs / 1000)}с`);

  const tick = async () => {
    try {
      const result = await syncCompletedTicketsFromTodoist(pool);
      if (result.closed > 0) {
        console.log(`Todoist sync: закрыто заявок ${result.closed}`);
      }
    } catch {
      console.error('Todoist sync poll failed');
    }
  };

  void tick();
  pollTimer = setInterval(() => void tick(), intervalMs);
};
