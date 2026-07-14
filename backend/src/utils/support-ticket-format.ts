import { getPriorityLabel, getThemeLabel } from './support-labels';
import type { SupportPriority } from './support-sla';
import { statusLabelRu } from './support-ticket-rules';
import type { SupportStatus } from './support-sla';

export type TicketFormatInput = {
  id: number | string;
  subject: string;
  body: string;
  priority: SupportPriority | string;
  category?: string | null;
  status?: SupportStatus | string;
  queue?: string | null;
  requesterName?: string | null;
  requesterEmail?: string | null;
  department?: string | null;
  position?: string | null;
  telegram?: string | null;
  createdAt?: Date | string | null;
};

export const formatTicketCode = (id: number | string): string => {
  const numeric = Number(id);
  if (!Number.isFinite(numeric) || numeric < 1) {
    return `#${id}`;
  }
  return `#IT-${String(Math.trunc(numeric)).padStart(6, '0')}`;
};

const formatDateRu = (value?: Date | string | null): string => {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const normalizeTelegram = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim().replace(/^@+/, '');
  return trimmed ? `@${trimmed}` : null;
};

const shortSubject = (subject: string, category?: string | null): string => {
  const theme = getThemeLabel(category);
  if (!subject || subject === theme) {
    return theme;
  }
  // «Тема: уточнение» → берём уточнение, иначе subject
  const prefix = `${theme}: `;
  if (subject.startsWith(prefix)) {
    return subject.slice(prefix.length);
  }
  return subject;
};

export const formatTodoistTaskContent = (ticket: TicketFormatInput): string => {
  const code = formatTicketCode(ticket.id);
  // Публичная: отдел из профиля; теневая: всегда «Тень»
  const dept =
    ticket.queue === 'shadow'
      ? 'Тень'
      : ticket.department?.trim() || '—';
  const theme = getThemeLabel(ticket.category);
  const urgency = getPriorityLabel(ticket.priority);
  const title = shortSubject(ticket.subject, ticket.category);
  const prefix = ticket.queue === 'shadow' ? '🛡 ' : '';
  // Тема отдельным сегментом — её назначает агент/админ
  return `${prefix}${code} | ${dept} | ${theme} | ${urgency} | ${title}`.slice(0, 500);
};

export const formatTodoistTaskDescription = (ticket: TicketFormatInput): string => {
  const code = formatTicketCode(ticket.id);
  const telegram = normalizeTelegram(ticket.telegram);
  const queueLabel = ticket.queue === 'shadow' ? 'Служебная' : 'Публичная';
  const lines = [
    `entech-ticket:${ticket.id}`,
    ticket.queue === 'shadow' ? 'entech-queue:shadow' : 'entech-queue:public',
    '',
    `🎫 Заявка: ${code}`,
    `🔐 Очередь: ${queueLabel}`,
    `👤 Заявитель: ${ticket.requesterName || '—'}`,
    ticket.position ? `💼 Должность: ${ticket.position}` : null,
    telegram ? `📱 Telegram: ${telegram}` : null,
    ticket.department ? `🏢 Отдел: ${ticket.department}` : null,
    `📁 Категория: ${getThemeLabel(ticket.category)}`,
    `⚠️ Срочность: ${getPriorityLabel(ticket.priority)}`,
    ticket.status ? `📌 Статус: ${statusLabelRu(ticket.status as any)}` : null,
    `🕒 Создано: ${formatDateRu(ticket.createdAt)}`,
    '',
    '📝 Описание',
    ticket.body?.trim() || '—',
  ];

  return lines.filter((line) => line !== null).join('\n');
};

/** HTML для Telegram (parse_mode HTML) */
export const formatTelegramNewTicketHtml = (ticket: TicketFormatInput): string => {
  const code = formatTicketCode(ticket.id);
  const telegram = normalizeTelegram(ticket.telegram);
  const escape = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const rows: Array<[string, string]> = [
    ['👤 Заявитель', ticket.requesterName || '—'],
  ];
  if (ticket.position) {
    rows.push(['💼 Должность', ticket.position]);
  }
  if (telegram) {
    rows.push(['📱 Telegram', telegram]);
  }
  if (ticket.department) {
    rows.push(['🏢 Отдел', ticket.department]);
  }
  rows.push(
    ['📁 Категория', getThemeLabel(ticket.category)],
    ['⚠️ Срочность', getPriorityLabel(ticket.priority)]
  );

  const meta = rows
    .map(([label, value]) => `<b>${label}:</b> ${escape(value)}`)
    .join('\n');

  const body = escape((ticket.body || '—').trim());

  return (
    `🆕 <b>Новая заявка ${escape(code)}</b>\n\n` +
    `${meta}\n\n` +
    `📝 <b>Описание:</b>\n${body}`
  );
};

export const formatTelegramStatusText = (ticket: {
  id: number | string;
  subject: string;
  status: SupportStatus;
}): string =>
  `📌 ${formatTicketCode(ticket.id)}\n${ticket.subject}\nСтатус: ${statusLabelRu(ticket.status)}`;
