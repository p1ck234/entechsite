export const BOOKING_SLOT_MINUTES = 30;
export const BOOKING_WORK_START_HOUR = 9;
export const BOOKING_WORK_END_HOUR = 19;
export const BOOKING_MAX_DURATION_HOURS = 4;
export const BOOKING_MAX_RECURRENCE_OCCURRENCES = 366;

export const BOOKING_TIMEZONE = 'Europe/Moscow';

export type BookingRecurrenceType = 'none' | 'weekly';

export interface BookingRecurrenceInput {
  type: BookingRecurrenceType;
  weekdays?: number[];
  untilDate?: string;
}

const getMoscowDateTimeParts = (value: Date) => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: BOOKING_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || '00';

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
};

export const combineDateAndTime = (date: string, time: string): Date => {
  const normalizedTime = time.length === 5 ? `${time}:00` : time.slice(0, 8);
  return new Date(`${date}T${normalizedTime}+03:00`);
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

  const startParts = getMoscowDateTimeParts(startsAt);
  const endParts = getMoscowDateTimeParts(endsAt);
  const startHour = Number(startParts.hour) + Number(startParts.minute) / 60;
  const endHour = Number(endParts.hour) + Number(endParts.minute) / 60;

  if (startHour < BOOKING_WORK_START_HOUR || endHour > BOOKING_WORK_END_HOUR) {
    return `Бронирование доступно с ${BOOKING_WORK_START_HOUR}:00 до ${BOOKING_WORK_END_HOUR}:00`;
  }

  const todayParts = getMoscowDateTimeParts(new Date());
  const todayMoscow = `${todayParts.year}-${todayParts.month}-${todayParts.day}`;
  const bookingDay = formatDateOnly(startsAt);

  if (bookingDay < todayMoscow) {
    return 'Нельзя бронировать прошедшие даты';
  }

  if (formatDateOnly(startsAt) !== formatDateOnly(endsAt)) {
    return 'Бронирование должно начинаться и заканчиваться в один день';
  }

  return null;
};

export const formatTimeFromDate = (value: Date | string): string => {
  const date = value instanceof Date ? value : new Date(value);
  const parts = getMoscowDateTimeParts(date);
  return `${parts.hour}:${parts.minute}`;
};

export const formatDateOnly = (value: Date | string): string => {
  const date = value instanceof Date ? value : new Date(value);
  const parts = getMoscowDateTimeParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const getWeekdayFromIsoDate = (value: string): number => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
};

const parseInputDate = (value: string): Date => new Date(`${value}T12:00:00+03:00`);

export const getWeekdayFromDate = (date: string): number => getWeekdayFromIsoDate(date);

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
    const isoDate = formatDateOnly(current);
    if (weekdays.includes(getWeekdayFromIsoDate(isoDate))) {
      dates.push(isoDate);
    }
    current.setDate(current.getDate() + 1);
  }

  return dates.length > 0 ? dates : [startDate];
};
