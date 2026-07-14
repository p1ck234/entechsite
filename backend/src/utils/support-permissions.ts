import { Pool } from 'pg';
import type { AuthRequest } from '../middleware/auth';
import type { SupportQueue } from './support-sla';

export const getShadowOperatorEmail = (): string =>
  (process.env.SUPPORT_SHADOW_OPERATOR_EMAIL || '').trim().toLowerCase();

export const isShadowOperatorEmail = (email: string | undefined | null): boolean => {
  const configured = getShadowOperatorEmail();
  if (!configured || !email) {
    return false;
  }
  return email.trim().toLowerCase() === configured;
};

export const isShadowOperatorUser = (user: AuthRequest['user'] | undefined): boolean =>
  Boolean(user && isShadowOperatorEmail(user.email));

export const canAccessShadowQueue = async (
  pool: Pool,
  user: AuthRequest['user'] | undefined
): Promise<boolean> => {
  if (!user) {
    return false;
  }

  if (isShadowOperatorEmail(user.email)) {
    return true;
  }

  const result = await pool.query(
    `SELECT 1 FROM support_shadow_operators
     WHERE LOWER(email) = LOWER($1) AND is_active = true
     LIMIT 1`,
    [user.email]
  );

  return result.rows.length > 0;
};

export const canAgentPublicQueue = async (
  pool: Pool,
  user: AuthRequest['user'] | undefined
): Promise<boolean> => {
  if (!user) {
    return false;
  }

  // Только назначенные обработчики. ADMIN без записи в support_agents
  // очередь не видит — настраивает через вкладку «Настройки».
  const result = await pool.query(
    `SELECT 1 FROM support_agents
     WHERE user_id = $1 AND is_active = true
     LIMIT 1`,
    [user.id]
  );

  return result.rows.length > 0;
};

export const canViewTicket = async (
  pool: Pool,
  user: AuthRequest['user'] | undefined,
  ticket: { queue: SupportQueue; requester_user_id: number | string }
): Promise<{ allowed: boolean; notFound: boolean }> => {
  if (!user) {
    return { allowed: false, notFound: true };
  }

  if (ticket.queue === 'shadow') {
    const shadowOk = await canAccessShadowQueue(pool, user);
    if (!shadowOk) {
      return { allowed: false, notFound: true };
    }
    return { allowed: true, notFound: false };
  }

  if (String(ticket.requester_user_id) === String(user.id)) {
    return { allowed: true, notFound: false };
  }

  if (await canAgentPublicQueue(pool, user)) {
    return { allowed: true, notFound: false };
  }

  return { allowed: false, notFound: false };
};

export const canTransitionTicket = async (
  pool: Pool,
  user: AuthRequest['user'] | undefined,
  queue: SupportQueue
): Promise<{ allowed: boolean; notFound: boolean }> => {
  if (!user) {
    return { allowed: false, notFound: true };
  }

  if (queue === 'shadow') {
    const shadowOk = await canAccessShadowQueue(pool, user);
    return shadowOk
      ? { allowed: true, notFound: false }
      : { allowed: false, notFound: true };
  }

  const agentOk = await canAgentPublicQueue(pool, user);
  return agentOk
    ? { allowed: true, notFound: false }
    : { allowed: false, notFound: false };
};

export const canCreateInQueue = async (
  pool: Pool,
  user: AuthRequest['user'] | undefined,
  queue: SupportQueue
): Promise<boolean> => {
  if (!user) {
    return false;
  }

  if (queue === 'public') {
    return true;
  }

  return canAccessShadowQueue(pool, user);
};

export const getSupportMeFlags = async (
  pool: Pool,
  user: AuthRequest['user'] | undefined
): Promise<{
  canAgentPublic: boolean;
  canShadow: boolean;
  canManageAgents: boolean;
}> => {
  if (!user) {
    return { canAgentPublic: false, canShadow: false, canManageAgents: false };
  }

  const [canAgentPublic, canShadow] = await Promise.all([
    canAgentPublicQueue(pool, user),
    canAccessShadowQueue(pool, user),
  ]);

  return {
    canAgentPublic,
    canShadow,
    canManageAgents: user.role === 'ADMIN',
  };
};
