import type { SupportQueue } from './support-sla';

/** Публичный бот поддержки = бот входа в портал (`BOT_TOKEN`). Override: SUPPORT_BOT_PUBLIC_TOKEN. */
export const getSupportBotToken = (queue: SupportQueue): string | null => {
  if (queue === 'shadow') {
    const shadow = (process.env.SUPPORT_BOT_SHADOW_TOKEN || '').trim();
    return shadow || null;
  }

  const explicit = (process.env.SUPPORT_BOT_PUBLIC_TOKEN || '').trim();
  if (explicit) {
    return explicit;
  }

  const portalBot =
    (process.env.BOT_TOKEN || '').trim() ||
    (process.env.TELEGRAM_BOT_TOKEN || '').trim();

  return portalBot || null;
};

export const getSupportBotSecret = (queue: SupportQueue): string | null => {
  const value =
    queue === 'shadow'
      ? process.env.SUPPORT_BOT_SHADOW_SECRET
      : process.env.SUPPORT_BOT_PUBLIC_SECRET;
  const trimmed = (value || '').trim();
  return trimmed || null;
};
