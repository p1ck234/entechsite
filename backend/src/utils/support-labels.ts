import type { SupportPriority } from './support-sla';
import { isSupportPriority } from './support-sla';

export const SUPPORT_THEME_IDS = [
  'printer',
  'computer',
  'network',
  'email',
  'access',
  'software',
  '1c',
  'phone',
  'other',
] as const;

export type SupportThemeId = (typeof SUPPORT_THEME_IDS)[number];

export const SUPPORT_THEMES: Array<{ id: SupportThemeId; label: string }> = [
  { id: 'printer', label: 'Принтер, сканер, оргтехника' },
  { id: 'computer', label: 'Компьютер или ноутбук' },
  { id: 'network', label: 'Сеть, интернет, VPN' },
  { id: 'email', label: 'Почта или календарь' },
  { id: 'access', label: 'Доступы и учётная запись' },
  { id: 'software', label: 'Портал или программы' },
  { id: '1c', label: '1С и учёт' },
  { id: 'phone', label: 'Телефония' },
  { id: 'other', label: 'Другое' },
];

export const SUPPORT_PRIORITY_LABELS: Record<SupportPriority, string> = {
  P1: 'Критично',
  P2: 'Важно',
  P3: 'Обычная',
};

export const isSupportThemeId = (value: unknown): value is SupportThemeId =>
  typeof value === 'string' && (SUPPORT_THEME_IDS as readonly string[]).includes(value);

export const getThemeLabel = (themeId: string | null | undefined): string => {
  const found = SUPPORT_THEMES.find((item) => item.id === themeId);
  if (found) {
    return found.label;
  }
  if (themeId && themeId !== 'other' && themeId !== 'telegram') {
    return themeId;
  }
  return 'Другое';
};

export const getPriorityLabel = (priority: string | null | undefined): string => {
  if (isSupportPriority(priority)) {
    return SUPPORT_PRIORITY_LABELS[priority];
  }
  return String(priority || '—');
};

export const buildTicketSubject = (themeId: SupportThemeId, detail?: string): string => {
  const theme = getThemeLabel(themeId);
  const trimmed = (detail || '').trim();
  if (!trimmed) {
    return theme;
  }
  return `${theme}: ${trimmed.slice(0, 180)}`;
};

export const parsePriorityFromHumanText = (text: string): SupportPriority | null => {
  const normalized = text.trim().toLowerCase();
  if (['p1', '1', 'критично', 'срочно', 'авария'].includes(normalized)) {
    return 'P1';
  }
  if (['p2', '2', 'важно', 'средний'].includes(normalized)) {
    return 'P2';
  }
  if (['p3', '3', 'обычно', 'обычная', 'не срочно', 'пропустить', 'skip', '-'].includes(normalized)) {
    return 'P3';
  }
  return isSupportPriority(text.trim().toUpperCase()) ? (text.trim().toUpperCase() as SupportPriority) : null;
};
