export const BOOKING_TIMEZONE = 'Europe/Moscow';

export const formatBookingTime = (value: string): string => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: BOOKING_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date(value));
  const hour = parts.find((part) => part.type === 'hour')?.value || '00';
  const minute = parts.find((part) => part.type === 'minute')?.value || '00';
  return `${hour}:${minute}`;
};

export const getBookingDate = (value: string): string => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BOOKING_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
};

export const formatBookingTimeRange = (startsAt: string, endsAt: string): string =>
  `${formatBookingTime(startsAt)}–${formatBookingTime(endsAt)}`;
