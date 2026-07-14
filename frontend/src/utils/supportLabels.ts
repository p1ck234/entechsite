import type { SupportPriority } from '../types';

export type SupportThemeId =
  | 'printer'
  | 'computer'
  | 'network'
  | 'email'
  | 'access'
  | 'software'
  | '1c'
  | 'phone'
  | 'other';

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

export const SUPPORT_PRIORITY_OPTIONS: Array<{
  value: SupportPriority;
  label: string;
  hint: string;
}> = [
  {
    value: 'P1',
    label: 'Критично',
    hint: 'Работа полностью встала — ответим примерно в течение часа',
  },
  {
    value: 'P2',
    label: 'Важно',
    hint: 'Сильно мешает работе — ответим в течение нескольких часов',
  },
  {
    value: 'P3',
    label: 'Обычная',
    hint: 'Можно подождать — разберём в течение рабочего дня',
  },
];

export const getThemeLabel = (themeId: string | null | undefined): string => {
  const found = SUPPORT_THEMES.find((item) => item.id === themeId);
  if (found) {
    return found.label;
  }
  // старые заявки могли хранить произвольную category
  if (themeId && themeId !== 'other' && themeId !== 'telegram') {
    return themeId;
  }
  return 'Другое';
};

export const getPriorityLabel = (priority: SupportPriority | string | null | undefined): string => {
  const found = SUPPORT_PRIORITY_OPTIONS.find((item) => item.value === priority);
  return found?.label || String(priority || '—');
};

export const buildTicketSubject = (themeId: SupportThemeId, detail?: string): string => {
  const theme = getThemeLabel(themeId);
  const trimmed = (detail || '').trim();
  if (!trimmed) {
    return theme;
  }
  return `${theme}: ${trimmed.slice(0, 180)}`;
};
