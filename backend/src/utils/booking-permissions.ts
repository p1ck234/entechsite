import type { AuthRequest } from '../middleware/auth';

export const canManageBooking = (
  user: AuthRequest['user'] | undefined,
  bookingUserId: string | number
): boolean => {
  if (!user) {
    return false;
  }

  if (user.role === 'ADMIN') {
    return true;
  }

  return String(bookingUserId) === String(user.id);
};

export const assertCanManageBooking = (
  user: AuthRequest['user'] | undefined,
  bookingUserId: string | number
): string | null => {
  if (canManageBooking(user, bookingUserId)) {
    return null;
  }

  return 'Можно изменять только свои бронирования';
};
