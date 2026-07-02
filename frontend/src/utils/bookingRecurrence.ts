export const BOOKING_MAX_RECURRENCE_OCCURRENCES = 366;

export type BookingRecurrenceType = 'none' | 'weekly';

export interface BookingRecurrenceInput {
  type: BookingRecurrenceType;
  weekdays?: number[];
  untilDate?: string;
}

export const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Пн' },
  { value: 2, label: 'Вт' },
  { value: 3, label: 'Ср' },
  { value: 4, label: 'Чт' },
  { value: 5, label: 'Пт' },
  { value: 6, label: 'Сб' },
  { value: 0, label: 'Вс' },
] as const;

const pad = (value: number): string => String(value).padStart(2, '0');

export const formatDateOnly = (value: Date): string =>
  `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;

const parseInputDate = (value: string): Date => {
  const date = new Date(`${value}T12:00:00`);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const getWeekdayFromDate = (date: string): number => parseInputDate(date).getDay();

export const normalizeWeekdays = (weekdays: number[]): number[] =>
  [...new Set(weekdays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort(
    (left, right) => left - right
  );

export const getDefaultRecurrenceUntilDate = (startDate: string): string => {
  const date = parseInputDate(startDate);
  date.setMonth(date.getMonth() + 3);
  return formatDateOnly(date);
};

export const expandRecurrenceDates = (
  startDate: string,
  recurrence: BookingRecurrenceInput
): string[] => {
  if (recurrence.type === 'none') {
    return [startDate];
  }

  const weekdays = normalizeWeekdays(recurrence.weekdays || []);
  if (weekdays.length === 0 || !recurrence.untilDate) {
    return [startDate];
  }

  const start = parseInputDate(startDate);
  const endDate = parseInputDate(recurrence.untilDate);

  if (endDate < start) {
    return [startDate];
  }

  const dates: string[] = [];
  const current = new Date(start);

  while (current <= endDate && dates.length < BOOKING_MAX_RECURRENCE_OCCURRENCES) {
    if (weekdays.includes(current.getDay())) {
      dates.push(formatDateOnly(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return dates.length > 0 ? dates : [startDate];
};
