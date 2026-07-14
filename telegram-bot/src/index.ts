import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';

dotenv.config();

type SupportQueue = 'public' | 'shadow';

const BOT_TOKEN = process.env.BOT_TOKEN;
const SHADOW_BOT_TOKEN = (process.env.SUPPORT_BOT_SHADOW_TOKEN || '').trim();
const BACKEND_URL = (process.env.BACKEND_URL || process.env.API_URL || '').replace(/\/$/, '');
const PUBLIC_FORWARD_SECRET = (process.env.SUPPORT_BOT_PUBLIC_SECRET || '').trim();
const SHADOW_FORWARD_SECRET = (process.env.SUPPORT_BOT_SHADOW_SECRET || '').trim();

if (!BOT_TOKEN) {
  console.error('❌ Ошибка: BOT_TOKEN не установлен в переменных окружения');
  console.error('💡 Установите переменную BOT_TOKEN в Railway или в файле .env');
  process.exit(1);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const BTN_NEW = '🆘 Новая заявка';
const BTN_MY = '📋 Мои заявки';
const BTN_CANCEL = '❌ Отмена';

const BUTTON_TO_COMMAND: Record<string, string> = {
  [BTN_NEW]: '/new',
  [BTN_MY]: '/my',
  [BTN_CANCEL]: '/cancel',
  'Новая заявка': '/new',
  'Мои заявки': '/my',
  Отмена: '/cancel',
};

const supportKeyboard: TelegramBot.ReplyKeyboardMarkup = {
  keyboard: [
    [{ text: BTN_NEW }, { text: BTN_MY }],
    [{ text: BTN_CANCEL }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

const normalizeSupportText = (text: string): string => {
  const trimmed = text.trim();
  if (BUTTON_TO_COMMAND[trimmed]) {
    return BUTTON_TO_COMMAND[trimmed];
  }
  return trimmed.split(/\s+/)[0]?.split('@')[0] || trimmed;
};

const forwardSupportUpdate = async (
  queue: SupportQueue,
  update: Record<string, unknown>
): Promise<boolean> => {
  if (!BACKEND_URL) {
    return false;
  }

  const secret = queue === 'shadow' ? SHADOW_FORWARD_SECRET : PUBLIC_FORWARD_SECRET;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (secret) {
    headers['x-telegram-bot-api-secret-token'] = secret;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/support-bots/webhook/${queue}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(update),
    });
    if (!response.ok) {
      console.error(`❌ Support webhook [${queue}] HTTP ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`❌ Не удалось переслать update в backend [${queue}]:`, error);
    return false;
  }
};

const startPollingSafely = async (bot: TelegramBot, label: string) => {
  try {
    await bot.deleteWebHook();
  } catch (error) {
    console.warn(`⚠️ [${label}] deleteWebHook:`, error);
  }

  await sleep(2500);

  try {
    const me = await bot.getMe();
    await bot.startPolling();
    console.log(
      `🤖 [${label}] polling: @${me.username || '?'} (id=${me.id})`
    );
  } catch (error) {
    console.error(`❌ [${label}] не удалось стартовать polling:`, error);
  }
};

const attachPollingRecovery = (bot: TelegramBot, label: string) => {
  let recoveringFrom409 = false;

  bot.on('polling_error', (error: any) => {
    const message = String(error?.message || error);
    if (message.includes('409 Conflict') || message.includes('terminated by other getUpdates')) {
      if (recoveringFrom409) {
        return;
      }
      recoveringFrom409 = true;
      console.warn(
        `⚠️ [${label}] Telegram 409 Conflict — повторный старт через 5с…`
      );
      void (async () => {
        try {
          await bot.stopPolling();
        } catch {
          // ignore
        }
        await sleep(5000);
        try {
          await bot.startPolling();
          console.log(`✅ [${label}] polling перезапущен после 409`);
        } catch (restartError) {
          console.error(`❌ [${label}] повторный старт polling не удался:`, restartError);
        } finally {
          recoveringFrom409 = false;
        }
      })();
      return;
    }
    console.error(`❌ [${label}] ошибка polling:`, error);
  });
};

const wireSupportBot = (bot: TelegramBot, queue: SupportQueue, label: string) => {
  const welcomePublic = (firstName: string) => `👋 Добро пожаловать в ENTECH GROUP, ${firstName}!

Мы рады вас видеть! 🎉

Для доступа к приложению нажмите на синюю кнопку «Открыть портал» внизу.

💻 *С рабочего компьютера:*
Перейдите по ссылке: [entech.p1ck23.ru/auth](https://entech.p1ck23.ru/auth)

🛟 *Техподдержка* — кнопки под полем ввода:
• «Новая заявка» — описать проблему
• «Мои заявки» — статус ваших обращений
• «Отмена» — сбросить черновик

Очередь заявок для сотрудников техподдержки — в разделе «Поддержка» на портале.

С уважением,
Команда ENTECH GROUP`;

  const welcomeShadow = (firstName: string) => `🛡 Служебная поддержка, ${firstName}

Это бот *теневой* очереди (раздел «Служебная» на портале).

Кнопки:
• «Новая заявка» — создать обращение
• «Мои заявки» — ваши обращения
• «Отмена» — сбросить черновик

Доступ только у назначенных операторов.
Заявки уходят в Todoist с пометкой «🛡» в названии.`;

  bot.onText(/\/start(?:@\w+)?(?:\s|$)/, async (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from?.first_name || 'Пользователь';
    console.log(`📨 [${label}] /start от ${firstName} (${chatId})`);

    try {
      await bot.sendMessage(
        chatId,
        queue === 'shadow' ? welcomeShadow(firstName) : welcomePublic(firstName),
        {
          parse_mode: 'Markdown',
          disable_web_page_preview: false,
          reply_markup: supportKeyboard,
        }
      );
    } catch (error) {
      console.error(`❌ [${label}] ошибка /start:`, error);
    }
  });

  bot.on('callback_query', async (query) => {
    const ok = await forwardSupportUpdate(queue, { callback_query: query });
    if (!ok && query.id) {
      try {
        await bot.answerCallbackQuery(query.id, { text: 'Поддержка временно недоступна' });
      } catch {
        // ignore
      }
    }
  });

  bot.on('message', async (msg) => {
    const text = (msg.text || '').trim();
    if (!text) {
      return;
    }

    const command = normalizeSupportText(text);
    if (command === '/start' || text.startsWith('/start')) {
      return;
    }

    const isSupportAction = ['/new', '/my', '/cancel', '/help', '/queue'].includes(command);
    const isButton = Boolean(BUTTON_TO_COMMAND[text]);
    const isPlainText = !text.startsWith('/') && !isButton;

    if (!isSupportAction && !isPlainText && !isButton) {
      if (text.startsWith('/')) {
        try {
          await bot.sendMessage(
            msg.chat.id,
            'Используйте кнопки: «Новая заявка», «Мои заявки», «Отмена».',
            { reply_markup: supportKeyboard }
          );
        } catch (error) {
          console.error(`❌ [${label}] ошибка подсказки:`, error);
        }
      }
      return;
    }

    const messageToForward =
      isSupportAction || isButton
        ? {
            ...msg,
            text: command.startsWith('/') ? command : text,
          }
        : msg;

    const ok = await forwardSupportUpdate(queue, { message: messageToForward });
    if (!ok && (isSupportAction || isButton)) {
      try {
        const hint = BACKEND_URL
          ? 'Backend не принял запрос. Проверьте деплой API и переменные бота.'
          : 'Нет BACKEND_URL у сервиса telegram-bot.';
        await bot.sendMessage(
          msg.chat.id,
          `Поддержка временно недоступна.\n${hint}`,
          { reply_markup: supportKeyboard }
        );
      } catch {
        // ignore
      }
    }
  });

  attachPollingRecovery(bot, label);
  void startPollingSafely(bot, label);
};

if (BACKEND_URL) {
  console.log(`🛟 Public → ${BACKEND_URL}/api/support-bots/webhook/public`);
  if (SHADOW_BOT_TOKEN) {
    console.log(`🛡 Shadow → ${BACKEND_URL}/api/support-bots/webhook/shadow`);
  }
} else {
  console.warn('⚠️ BACKEND_URL не задан — кнопки поддержки недоступны');
}

const publicBot = new TelegramBot(BOT_TOKEN, { polling: false });
wireSupportBot(publicBot, 'public', 'public');

const shadowBots: TelegramBot[] = [];
if (SHADOW_BOT_TOKEN) {
  if (SHADOW_BOT_TOKEN === BOT_TOKEN) {
    console.warn(
      '⚠️ SUPPORT_BOT_SHADOW_TOKEN совпадает с BOT_TOKEN — служебный бот должен быть ОТДЕЛЬНЫМ'
    );
  } else {
    const shadowBot = new TelegramBot(SHADOW_BOT_TOKEN, { polling: false });
    shadowBots.push(shadowBot);
    wireSupportBot(shadowBot, 'shadow', 'shadow');
  }
} else {
  console.warn(
    '⚠️ SUPPORT_BOT_SHADOW_TOKEN не задан — служебный бот не слушает сообщения (только ответ backend, если токен есть там)'
  );
}

const shutdown = async (signal: string) => {
  console.log(`\n⚠️ ${signal}: останавливаем polling…`);
  for (const instance of [publicBot, ...shadowBots]) {
    try {
      await instance.stopPolling();
    } catch {
      // ignore
    }
  }
  process.exit(0);
};

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

console.log('✅ Handlers готовы');
