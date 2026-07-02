export const BOOKING_MAX_ADVANCE_DAYS = 30;
export const BOOKING_MAX_RECURRENCE_OCCURRENCES = 30;

export type BookingRecurrenceType = 'none' | 'daily' | 'weekly' | 'weekdays';

export interface BookingRecurrenceInput {
  type: BookingRecurrenceType;
  untilDate?: string;
}

const pad = (value: number): string => String(value).padStart(2, '0');

export const formatDateOnly = (value: Date): string =>
  `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;

export const getMaxBookingDate = (): string => {
  const maxDate = new Date();
  maxDate.setHours(0, 0, 0, 0);
  maxDate.setDate(maxDate.getDate() + BOOKING_MAX_ADVANCE_DAYS);
  return formatDateOnly(maxDate);
};

const parseInputDate = (value: string): Date => {
  const date = new Date(`${value}T12:00:00`);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const expandRecurrenceDates = (
  startDate: string,
  recurrence: BookingRecurrenceInput
): string[] => {
  if (recurrence.type === 'none') {
    return [startDate];
  }

  const start = parseInputDate(startDate);
  const maxDate = parseInputDate(getMaxBookingDate());
  const until = recurrence.untilDate ? parseInputDate(recurrence.untilDate) : maxDate;
  const endDate = until > maxDate ? maxDate : until;

  if (endDate < start) {
    return [startDate];
  }

  const dates: string[] = [startDate];
  let current = new Date(start);

  while (dates.length < BOOKING_MAX_RECURRENCE_OCCURRENCES) {
    if (recurrence.type === 'daily') {
      current.setDate(current.getDate() + 1);
    } else if (recurrence.type === 'weekly') {
      current.setDate(current.getDate() + 7);
    } else if (recurrence.type === 'weekdays') {
      do {
        current.setDate(current.getDate() + 1);
      } while (current.getDay() === 0 || current.getDay() === 6);
    } else {
      break;
    }

    if (current > endDate) {
      break;
    }

    dates.push(formatDateOnly(current));
  }

  return dates;
};

export const RECURRENCE_OPTIONS: Array<{ value: BookingRecurrenceType; label: string }> = [
  { value: 'none', label: 'Не повторяется' },
  { value: 'daily', label: 'Каждый день' },
  { value: 'weekly', label: 'Каждую неделю' },
  { value: 'weekdays', label: 'По будням (Пн–Пт)' },
];
