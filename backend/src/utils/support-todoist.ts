import { Pool } from 'pg';
import type { SupportPriority, SupportStatus } from './support-sla';
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

/** Колонки канбана → статусы портала (имена секций Todoist, без регистра) */
const SECTION_STATUS_MAP: Record<string, SupportStatus> = {
  входящие: 'new',
  inbox: 'new',
  backlog: 'new', // старые задачи / fallback
  неделя: 'acknowledged',
  сегодня: 'in_progress',
  ждун: 'waiting',
  ожидание: 'waiting',
};

let cachedProjectId: string | null | undefined;
let cachedSectionsByProject = new Map<string, Map<string, string>>(); // projectId → nameNorm → sectionId
let cachedSectionIdToStatus = new Map<string, SupportStatus>(); // sectionId → status
let cachedTodoistUsers = new Map<string, { id: string; email?: string; name?: string }>();

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

const normalizeSectionName = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, ' ');

export const resolveTodoistProjectId = async (
  queue?: string | null
): Promise<string | undefined> => {
  if (queue === 'shadow') {
    const shadowProject = (process.env.TODOIST_SHADOW_PROJECT_ID || '').trim();
    if (shadowProject) {
      return shadowProject;
    }
  }

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

    const data = (await response.json()) as
      | { results?: Array<{ id: string; name: string }> }
      | Array<{ id: string; name: string }>;
    const list = Array.isArray(data) ? data : data.results || [];
    const exact = list.find((p) => p.name === wanted);
    const partial = list.find(
      (p) => p.name.includes('HQ/ЭГ/C') && !p.name.includes('Операционная')
    );
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

const loadSections = async (projectId: string): Promise<void> => {
  if (cachedSectionsByProject.has(projectId)) {
    return;
  }

  const token = getTodoistToken();
  if (!token) {
    return;
  }

  try {
    const response = await fetch(
      `${TODOIST_API}/sections?project_id=${encodeURIComponent(projectId)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!response.ok) {
      return;
    }
    const data = (await response.json()) as
      | { results?: Array<{ id: string; name: string }> }
      | Array<{ id: string; name: string }>;
    const list = Array.isArray(data) ? data : data.results || [];
    const byName = new Map<string, string>();
    for (const section of list) {
      const norm = normalizeSectionName(section.name);
      byName.set(norm, String(section.id));
      const status = SECTION_STATUS_MAP[norm];
      if (status) {
        cachedSectionIdToStatus.set(String(section.id), status);
      }
    }
    cachedSectionsByProject.set(projectId, byName);
    console.log(
      `✅ Todoist sections: ${list.map((s) => s.name).join(', ') || '(нет)'}`
    );
  } catch {
    // ignore
  }
};

type TodoistTaskSnapshot = {
  id: string;
  isCompleted: boolean;
  sectionId: string | null;
  assigneeId: string | null;
  content?: string;
  description?: string;
};

const fetchTodoistTask = async (taskId: string): Promise<TodoistTaskSnapshot | 'missing' | null> => {
  const token = getTodoistToken();
  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${TODOIST_API}/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 404) {
      return 'missing';
    }
    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      id?: string | number;
      is_completed?: boolean;
      checked?: boolean;
      section_id?: string | number | null;
      assignee_id?: string | number | null;
      responsible_uid?: string | number | null;
      content?: string;
      description?: string;
    };

    return {
      id: String(data.id ?? taskId),
      isCompleted: Boolean(data.is_completed || data.checked),
      sectionId: data.section_id != null ? String(data.section_id) : null,
      assigneeId:
        data.assignee_id != null
          ? String(data.assignee_id)
          : data.responsible_uid != null
            ? String(data.responsible_uid)
            : null,
      content: data.content,
      description: data.description,
    };
  } catch {
    return null;
  }
};

/** Ручной маппинг TODOIST_USER_MAP=todoistId:email,todoistId2:email2 */
const parseManualUserMap = (): Map<string, string> => {
  const raw = (process.env.TODOIST_USER_MAP || '').trim();
  const map = new Map<string, string>();
  if (!raw) {
    return map;
  }
  for (const part of raw.split(',')) {
    const [id, email] = part.split(':').map((s) => s.trim());
    if (id && email) {
      map.set(id, email.toLowerCase());
    }
  }
  return map;
};

const resolvePortalUserIdByTodoist = async (
  pool: Pool,
  todoistUserId: string | null | undefined
): Promise<string | null> => {
  if (!todoistUserId) {
    return null;
  }

  const manual = parseManualUserMap().get(todoistUserId);
  if (manual) {
    const byEmail = await pool.query(
      `SELECT u.id FROM users u WHERE LOWER(u.email) = LOWER($1) LIMIT 1`,
      [manual]
    );
    if (byEmail.rows[0]) {
      return String(byEmail.rows[0].id);
    }
  }

  // Кэш/collaborators обычно без email в REST — пробуем совпадение по employees.telegram/email позже через map
  const cached = cachedTodoistUsers.get(todoistUserId);
  if (cached?.email) {
    const byEmail = await pool.query(
      `SELECT u.id FROM users u WHERE LOWER(u.email) = LOWER($1) LIMIT 1`,
      [cached.email]
    );
    if (byEmail.rows[0]) {
      return String(byEmail.rows[0].id);
    }
  }

  return null;
};

const applyTicketStatusFromTodoist = async (
  pool: Pool,
  ticket: any,
  toStatus: SupportStatus,
  actorUserId: string | null
): Promise<boolean> => {
  if (ticket.status === toStatus) {
    if (actorUserId && toStatus !== 'done') {
      await pool.query(
        `UPDATE support_tickets SET
           assignee_user_id = COALESCE($2::int, assignee_user_id),
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [ticket.id, actorUserId]
      );
    }
    return false;
  }

  const now = new Date();
  const fromStatus = ticket.status as SupportStatus;

  let sql = '';
  const params: any[] = [ticket.id, now, actorUserId];

  if (toStatus === 'new') {
    sql = `UPDATE support_tickets SET
      status = 'new',
      acknowledged_at = NULL, acknowledged_by = NULL,
      started_at = NULL, resolved_at = NULL, resolved_by = NULL,
      assignee_user_id = COALESCE($3::int, assignee_user_id),
      updated_at = $2
     WHERE id = $1 AND status <> 'done'
     RETURNING *`;
  } else if (toStatus === 'acknowledged') {
    sql = `UPDATE support_tickets SET
      status = 'acknowledged',
      acknowledged_at = COALESCE(acknowledged_at, $2),
      acknowledged_by = COALESCE($3::int, acknowledged_by),
      assignee_user_id = COALESCE($3::int, assignee_user_id),
      started_at = NULL, resolved_at = NULL, resolved_by = NULL,
      updated_at = $2
     WHERE id = $1 AND status <> 'done'
     RETURNING *`;
  } else if (toStatus === 'in_progress') {
    sql = `UPDATE support_tickets SET
      status = 'in_progress',
      acknowledged_at = COALESCE(acknowledged_at, $2),
      acknowledged_by = COALESCE(acknowledged_by, $3::int),
      started_at = COALESCE(started_at, $2),
      assignee_user_id = COALESCE($3::int, assignee_user_id),
      resolved_at = NULL, resolved_by = NULL,
      updated_at = $2
     WHERE id = $1 AND status <> 'done'
     RETURNING *`;
  } else if (toStatus === 'waiting') {
    sql = `UPDATE support_tickets SET
      status = 'waiting',
      acknowledged_at = COALESCE(acknowledged_at, $2),
      acknowledged_by = COALESCE(acknowledged_by, $3::int),
      started_at = COALESCE(started_at, $2),
      assignee_user_id = COALESCE($3::int, assignee_user_id),
      resolved_at = NULL, resolved_by = NULL,
      updated_at = $2
     WHERE id = $1 AND status <> 'done'
     RETURNING *`;
  } else {
    return false;
  }

  const updated = await pool.query(sql, params);
  if (updated.rows.length === 0) {
    return false;
  }

  await pool.query(
    `INSERT INTO support_ticket_events
      (ticket_id, actor_user_id, event_type, from_status, to_status, note)
     VALUES ($1, $2, $3, $4, $5, 'todoist-board')`,
    [
      ticket.id,
      actorUserId,
      `status_${toStatus}`,
      fromStatus,
      toStatus,
    ]
  );

  const next = updated.rows[0];
  // «Ожидание» (Ждун) — служебный статус, пользователю не шлём
  if (toStatus !== 'waiting') {
    void notifyTelegramStatusChange({
      queue: next.queue,
      chatId: next.telegram_chat_id,
      ticketId: next.id,
      subject: next.subject,
      status: toStatus,
    });
  }

  return true;
};

export const createTodoistTaskForTicket = async (
  ticket: TicketFormatInput
): Promise<string | null> => {
  const token = getTodoistToken();
  if (!token) {
    return null;
  }

  const projectId = await resolveTodoistProjectId(ticket.queue);
  const content = formatTodoistTaskContent(ticket);
  const description = formatTodoistTaskDescription(ticket);
  try {
    // Без section_id — задача в проекте «как есть», без колонки Backlog/Входящие
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
  const snap = await fetchTodoistTask(taskId);
  if (snap === 'missing') {
    return true;
  }
  if (!snap) {
    return null;
  }
  return snap.isCompleted;
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
  ticketId: number,
  actorUserId?: string | null
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
  const resolver = actorUserId || ticket.assignee_user_id || null;
  const updated = await pool.query(
    `UPDATE support_tickets SET
       status = 'done',
       acknowledged_at = COALESCE(acknowledged_at, $2),
       started_at = COALESCE(started_at, $2),
       resolved_at = $2,
       resolved_by = COALESCE($3::int, resolved_by),
       assignee_user_id = COALESCE(assignee_user_id, $3::int),
       resolution_note = COALESCE(resolution_note, 'Закрыто в Todoist'),
       updated_at = $2
     WHERE id = $1 AND status <> 'done'
     RETURNING *`,
    [ticketId, now, resolver]
  );

  if (updated.rows.length === 0) {
    return true;
  }

  await pool.query(
    `INSERT INTO support_ticket_events
      (ticket_id, actor_user_id, event_type, from_status, to_status, note)
     VALUES ($1, $2, 'status_done', $3, 'done', 'todoist')`,
    [ticketId, resolver, ticket.status]
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
): Promise<{ checked: number; closed: number; moved: number }> => {
  if (!getTodoistToken()) {
    return { checked: 0, closed: 0, moved: 0 };
  }

  const projectId = await resolveTodoistProjectId('public');
  if (projectId) {
    await loadSections(projectId);
  }
  const shadowProject = await resolveTodoistProjectId('shadow');
  if (shadowProject && shadowProject !== projectId) {
    await loadSections(shadowProject);
  }

  const open = await pool.query(
    `SELECT * FROM support_tickets
     WHERE status <> 'done' AND todoist_task_id IS NOT NULL
     ORDER BY updated_at ASC
     LIMIT 40`
  );

  let closed = 0;
  let moved = 0;

  for (const row of open.rows) {
    const snap = await fetchTodoistTask(String(row.todoist_task_id));
    if (snap === null) {
      continue;
    }

    if (snap === 'missing' || snap.isCompleted) {
      let actor: string | null = null;
      if (snap !== 'missing' && snap.assigneeId) {
        actor = await resolvePortalUserIdByTodoist(pool, snap.assigneeId);
      }
      actor = actor || (row.assignee_user_id ? String(row.assignee_user_id) : null);
      const ok = await resolveTicketFromTodoist(pool, Number(row.id), actor);
      if (ok) {
        closed += 1;
      }
      continue;
    }

    const actor = await resolvePortalUserIdByTodoist(pool, snap.assigneeId);

    if (actor && String(row.assignee_user_id || '') !== actor) {
      await pool.query(
        `UPDATE support_tickets SET assignee_user_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [row.id, actor]
      );
    }

    if (snap.sectionId) {
      let target = cachedSectionIdToStatus.get(snap.sectionId);
      if (!target) {
        // секции могли появиться позже — обновим кэш по известным проектам
        if (projectId) {
          cachedSectionsByProject.delete(projectId);
          await loadSections(projectId);
        }
        if (shadowProject) {
          cachedSectionsByProject.delete(shadowProject);
          await loadSections(shadowProject);
        }
        target = cachedSectionIdToStatus.get(snap.sectionId);
      }

      if (target && target !== 'done') {
        const changed = await applyTicketStatusFromTodoist(pool, row, target, actor);
        if (changed) {
          moved += 1;
        }
      }
    }
  }

  return { checked: open.rows.length, closed, moved };
};

let pollTimer: NodeJS.Timeout | null = null;

export const startTodoistPolling = (pool: Pool): void => {
  if (!getTodoistToken() || pollTimer) {
    return;
  }

  const intervalMs = Number(process.env.TODOIST_SYNC_INTERVAL_MS || 60_000);
  console.log(`✅ Todoist sync: опрос каждые ${Math.round(intervalMs / 1000)}с (доска + закрытие)`);

  const tick = async () => {
    try {
      const result = await syncCompletedTicketsFromTodoist(pool);
      if (result.closed > 0 || result.moved > 0) {
        console.log(
          `Todoist sync: checked=${result.checked}, closed=${result.closed}, moved=${result.moved}`
        );
      }
    } catch {
      console.error('Todoist sync poll failed');
    }
  };

  // Не гоняем Todoist сразу при старте — иначе первые запросы портала тормозятся
  const warmMs = Number(process.env.TODOIST_SYNC_WARMUP_MS || 45_000);
  setTimeout(() => {
    void tick();
    pollTimer = setInterval(() => void tick(), intervalMs);
  }, Math.max(5_000, warmMs)).unref?.();
};
