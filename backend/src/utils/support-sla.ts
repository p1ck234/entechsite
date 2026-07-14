export type SupportPriority = 'P1' | 'P2' | 'P3';
export type SupportStatus = 'new' | 'acknowledged' | 'in_progress' | 'waiting' | 'done';
export type SupportQueue = 'public' | 'shadow';

/** SLA в миллисекундах (календарное время) */
export const SUPPORT_SLA_MS: Record<
  SupportPriority,
  { responseMs: number; resolveMs: number }
> = {
  P1: { responseMs: 1 * 60 * 60 * 1000, resolveMs: 4 * 60 * 60 * 1000 },
  P2: { responseMs: 4 * 60 * 60 * 1000, resolveMs: 24 * 60 * 60 * 1000 },
  P3: { responseMs: 24 * 60 * 60 * 1000, resolveMs: 72 * 60 * 60 * 1000 },
};

export const SUPPORT_PRIORITIES: SupportPriority[] = ['P1', 'P2', 'P3'];
export const SUPPORT_STATUSES: SupportStatus[] = [
  'new',
  'acknowledged',
  'in_progress',
  'waiting',
  'done',
];

export const isSupportPriority = (value: unknown): value is SupportPriority =>
  typeof value === 'string' && SUPPORT_PRIORITIES.includes(value as SupportPriority);

export const computeSlaDeadlines = (
  priority: SupportPriority,
  createdAt: Date
): { responseDueAt: Date; resolveDueAt: Date } => {
  const sla = SUPPORT_SLA_MS[priority];
  return {
    responseDueAt: new Date(createdAt.getTime() + sla.responseMs),
    resolveDueAt: new Date(createdAt.getTime() + sla.resolveMs),
  };
};

export const msBetween = (from: Date | string | null, to: Date | string | null): number | null => {
  if (!from || !to) {
    return null;
  }
  return new Date(to).getTime() - new Date(from).getTime();
};

export const isWithinSla = (
  dueAt: Date | string | null | undefined,
  actualAt: Date | string | null | undefined
): boolean | null => {
  if (!dueAt || !actualAt) {
    return null;
  }
  return new Date(actualAt).getTime() <= new Date(dueAt).getTime();
};
