import type { SupportStatus } from './support-sla';

const ALLOWED_TRANSITIONS: Record<SupportStatus, SupportStatus[]> = {
  new: ['acknowledged'],
  acknowledged: ['in_progress'],
  in_progress: ['done'],
  done: [],
};

export const canTransitionStatus = (
  from: SupportStatus,
  to: SupportStatus
): { valid: boolean; reason?: string } => {
  if (from === to) {
    return { valid: false, reason: 'Заявка уже в этом статусе' };
  }

  const allowed = ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    return {
      valid: false,
      reason: `Нельзя перейти из «${from}» в «${to}». Ожидается: ${allowed.join(', ') || 'нет'}`,
    };
  }

  return { valid: true };
};

export const statusLabelRu = (status: SupportStatus): string => {
  switch (status) {
    case 'new':
      return 'Новая';
    case 'acknowledged':
      return 'Подтверждена';
    case 'in_progress':
      return 'В работе';
    case 'done':
      return 'Готово';
    default:
      return status;
  }
};
