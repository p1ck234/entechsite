export const BOOKING_SLOT_MINUTES = 30;
export const BOOKING_WORK_START_HOUR = 9;
export const BOOKING_WORK_END_HOUR = 19;
export const BOOKING_MAX_DURATION_HOURS = 4;
export const BOOKING_MAX_RECURRENCE_OCCURRENCES = 366;

export type BookingRecurrenceType = 'none' | 'weekly';

export interface BookingRecurrenceInput {
  type: BookingRecurrenceType;
  weekdays?: number[];
  untilDate?: string;
}

const pad = (value: number): string => String(value).padStart(2, '0');

export const combineDateAndTime = (date: string, time: string): Date => {
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  return new Date(`${date}T${normalizedTime}`);
};

export const validateBookingWindow = (startsAt: Date, endsAt: Date): string | null => {
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return 'Некорректная дата или время';
  }

  if (endsAt <= startsAt) {
    return 'Время окончания должно быть позже начала';
  }

  const durationMinutes = (endsAt.getTime() - startsAt.getTime()) / 60000;
  if (durationMinutes < BOOKING_SLOT_MINUTES) {
    return `Минимальная длительность — ${BOOKING_SLOT_MINUTES} минут`;
  }

  if (durationMinutes > BOOKING_MAX_DURATION_HOURS * 60) {
    return `Максимальная длительность — ${BOOKING_MAX_DURATION_HOURS} часа`;
  }

  const startHour = startsAt.getHours() + startsAt.getMinutes() / 60;
  const endHour = endsAt.getHours() + endsAt.getMinutes() / 60;

  if (startHour < BOOKING_WORK_START_HOUR || endHour > BOOKING_WORK_END_HOUR) {
    return `Бронирование доступно с ${BOOKING_WORK_START_HOUR}:00 до ${BOOKING_WORK_END_HOUR}:00`;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const bookingDay = new Date(startsAt);
  bookingDay.setHours(0, 0, 0, 0);

  if (bookingDay < today) {
    return 'Нельзя бронировать прошедшие даты';
  }

  if (startsAt.toDateString() !== endsAt.toDateString()) {
    return 'Бронирование должно начинаться и заканчиваться в один день';
  }

  return null;
};

export const formatTimeFromDate = (value: Date | string): string => {
  const date = value instanceof Date ? value : new Date(value);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const formatDateOnly = (value: Date | string): string => {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const parseInputDate = (value: string): Date => {
  const date = new Date(`${value}T12:00:00`);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const getWeekdayFromDate = (date: string): number => parseInputDate(date).getDay();

export const normalizeWeekdays = (weekdays?: number[]): number[] => {
  if (!Array.isArray(weekdays)) {
    return [];
  }

  return [...new Set(weekdays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort(
    (left, right) => left - right
  );
};

export const getDefaultRecurrenceUntilDate = (startDate: string): string => {
  const date = parseInputDate(startDate);
  date.setMonth(date.getMonth() + 3);
  return formatDateOnly(date);
};

export const validateRecurrenceInput = (
  recurrence: BookingRecurrenceInput,
  startDate: string
): string | null => {
  if (recurrence.type === 'none') {
    return null;
  }

  const weekdays = normalizeWeekdays(recurrence.weekdays);
  if (weekdays.length === 0) {
    return 'Выберите хотя бы один день недели для повторения';
  }

  if (!recurrence.untilDate) {
    return 'Укажите дату окончания повторения';
  }

  const start = parseInputDate(startDate);
  const until = parseInputDate(recurrence.untilDate);

  if (until < start) {
    return 'Дата окончания повторения не может быть раньше начала';
  }

  return null;
};

export const expandRecurrenceDates = (
  startDate: string,
  recurrence: BookingRecurrenceInput
): string[] => {
  if (recurrence.type === 'none') {
    return [startDate];
  }

  const weekdays = normalizeWeekdays(recurrence.weekdays);
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
