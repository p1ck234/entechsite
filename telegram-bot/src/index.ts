import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';

dotenv.config();

// Получаем токен бота из переменных окружения (тот же бот, что вход в портал)
const BOT_TOKEN = process.env.BOT_TOKEN;
const BACKEND_URL = (process.env.BACKEND_URL || process.env.API_URL || '').replace(/\/$/, '');
const SUPPORT_FORWARD_SECRET = (process.env.SUPPORT_BOT_PUBLIC_SECRET || '').trim();

if (!BOT_TOKEN) {
  console.error('❌ Ошибка: BOT_TOKEN не установлен в переменных окружения');
  console.error('💡 Установите переменную BOT_TOKEN в Railway или в файле .env');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

console.log('🤖 Telegram бот запускается...');
if (BACKEND_URL) {
  console.log(`🛟 Публичная техподдержка: forward → ${BACKEND_URL}/api/support-bots/webhook/public`);
} else {
  console.warn('⚠️ BACKEND_URL не задан — кнопки поддержки недоступны');
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const startPollingSafely = async () => {
  try {
    // Убираем webhook, иначе конфликтует с getUpdates (polling)
    await bot.deleteWebHook();
  } catch (error) {
    console.warn('⚠️ deleteWebHook:', error);
  }

  // После рестарта старый инстанс может ещё держать long-poll пару секунд
  await sleep(2500);

  try {
    await bot.startPolling();
    console.log('🤖 Telegram бот запущен (polling)');
  } catch (error) {
    console.error('❌ Не удалось стартовать polling:', error);
  }
};

void startPollingSafely();

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

const forwardSupportUpdate = async (update: Record<string, unknown>): Promise<boolean> => {
  if (!BACKEND_URL) {
    return false;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (SUPPORT_FORWARD_SECRET) {
    headers['x-telegram-bot-api-secret-token'] = SUPPORT_FORWARD_SECRET;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/support-bots/webhook/public`, {
      method: 'POST',
      headers,
      body: JSON.stringify(update),
    });
    if (!response.ok) {
      console.error(`❌ Support webhook HTTP ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error('❌ Не удалось переслать update в backend support:', error);
    return false;
  }
};

// Обработка команды /start
bot.onText(/\/start(?:@\w+)?(?:\s|$)/, async (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from?.first_name || 'Пользователь';

  console.log(`📨 Получена команда /start от пользователя ${firstName} (ID: ${chatId})`);

  const welcomeMessage = `👋 Добро пожаловать в ENTECH GROUP, ${firstName}!

Мы рады вас видеть! 🎉

Для доступа к приложению нажмите на синюю кнопку «Открыть портал» внизу.

💻 *С рабочего компьютера:*
Перейдите по ссылке: [entech.p1ck23.ru/auth](https://entech.p1ck23.ru/auth)

🛟 *Техподдержка* — кнопки под полем ввода:
• «Новая заявка» — описать проблему
• «Мои заявки» — статус ваших обращений
• «Отмена» — сбросить черновик

Очередь заявок для сотрудников техподдержки — в разделе «Поддержка» на портале.

Если у вас возникнут вопросы, обращайтесь к администратору.

С уважением,
Команда ENTECH GROUP`;

  try {
    await bot.sendMessage(chatId, welcomeMessage, {
      parse_mode: 'Markdown',
      disable_web_page_preview: false,
      reply_markup: supportKeyboard,
    });
    console.log(`✅ Приветственное сообщение отправлено пользователю ${firstName} (ID: ${chatId})`);
  } catch (error) {
    console.error(`❌ Ошибка при отправке сообщения пользователю ${chatId}:`, error);
  }
});

bot.on('callback_query', async (query) => {
  const ok = await forwardSupportUpdate({ callback_query: query });
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
          'Используйте кнопки под полем ввода: «Новая заявка», «Мои заявки», «Отмена».\nИли откройте раздел «Поддержка» на портале.',
          { reply_markup: supportKeyboard }
        );
      } catch (error) {
        console.error(`❌ Ошибка при отправке сообщения:`, error);
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

  const ok = await forwardSupportUpdate({ message: messageToForward });
  if (!ok && (isSupportAction || isButton)) {
    try {
      const hint = BACKEND_URL
        ? 'Backend не принял запрос. Проверьте деплой API и логи telegram-bot.'
        : 'На сервисе telegram-bot в Railway нет переменной BACKEND_URL (URL backend).';
      await bot.sendMessage(
        msg.chat.id,
        `Техподдержка временно недоступна.\n${hint}\n\nЛибо откройте раздел «Поддержка» на портале.`,
        { reply_markup: supportKeyboard }
      );
    } catch {
      // ignore
    }
  }
});

let recoveringFrom409 = false;

bot.on('polling_error', (error: any) => {
  const message = String(error?.message || error);
  if (message.includes('409 Conflict') || message.includes('terminated by other getUpdates')) {
    if (recoveringFrom409) {
      return;
    }
    recoveringFrom409 = true;
    console.warn(
      '⚠️ Telegram 409 Conflict: другой getUpdates ещё активен (обычно во время деплоя). Повторный старт через 5с…'
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
        console.log('✅ Polling перезапущен после 409');
      } catch (restartError) {
        console.error('❌ Повторный старт polling не удался:', restartError);
      } finally {
        recoveringFrom409 = false;
      }
    })();
    return;
  }
  console.error('❌ Ошибка polling:', error);
});

const shutdown = async (signal: string) => {
  console.log(`\n⚠️ ${signal}: останавливаем polling…`);
  try {
    await bot.stopPolling();
  } catch {
    // ignore
  }
  process.exit(0);
};

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

console.log('✅ Бот инициализирован, handlers готовы');
