export const extractIsoDate = (value: string): string => {
  const trimmedValue = value.trim();
  const datePart = trimmedValue.includes('T')
    ? trimmedValue.split('T')[0]
    : trimmedValue.split(' ')[0];

  const isoDateMatch = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!isoDateMatch) {
    return '';
  }

  return `${isoDateMatch[1]}-${isoDateMatch[2]}-${isoDateMatch[3]}`;
};

export const toInputDate = (value?: string | Date | null): string => {
  if (!value) {
    return '';
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return '';
    }
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return extractIsoDate(value);
};

export const formatRuDate = (value: string): string => {
  const isoDate = extractIsoDate(value);
  if (!isoDate) {
    return 'Дата не указана';
  }

  const [year, month, day] = isoDate.split('-').map(Number);
  const parsedDate = new Date(year, month - 1, day);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Дата не указана';
  }

  return parsedDate.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const parseIsoDate = (value: string): Date => {
  const isoDate = extractIsoDate(value);
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const addDays = (value: string, days: number): string => {
  const date = parseIsoDate(value);
  date.setDate(date.getDate() + days);
  return toInputDate(date);
};

export const getWeekStart = (value?: string | Date | null): string => {
  const date = value instanceof Date ? new Date(value) : value ? parseIsoDate(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return getWeekStart(new Date());
  }

  const weekday = date.getDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  date.setDate(date.getDate() + mondayOffset);
  return toInputDate(date);
};

export const getWeekDays = (weekStart: string): string[] =>
  Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

export const formatWeekdayShort = (value: string): string => {
  const date = parseIsoDate(value);
  return date.toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
};

export const formatWeekRange = (weekStart: string, weekEnd: string): string => {
  const start = parseIsoDate(weekStart);
  const end = parseIsoDate(weekEnd);
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();

  const startLabel = start.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: sameMonth ? 'long' : 'short',
    year: sameYear ? undefined : 'numeric',
  });
  const endLabel = end.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return `${startLabel} — ${endLabel}`;
};

export const isPastDate = (value: string): boolean => {
  const today = toInputDate(new Date());
  return extractIsoDate(value) < today;
};

export const isSameDate = (left: string, right: string): boolean =>
  extractIsoDate(left) === extractIsoDate(right);
