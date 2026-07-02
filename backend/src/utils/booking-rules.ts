export const BOOKING_SLOT_MINUTES = 30;
export const BOOKING_WORK_START_HOUR = 9;
export const BOOKING_WORK_END_HOUR = 19;
export const BOOKING_MAX_DURATION_HOURS = 4;
export const BOOKING_MAX_ADVANCE_DAYS = 30;

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

  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + BOOKING_MAX_ADVANCE_DAYS);
  if (bookingDay > maxDate) {
    return `Можно бронировать не более чем на ${BOOKING_MAX_ADVANCE_DAYS} дней вперёд`;
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
