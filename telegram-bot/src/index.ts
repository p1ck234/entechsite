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

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('🤖 Telegram бот запущен и готов к работе');
if (BACKEND_URL) {
  console.log(`🛟 Публичная техподдержка: forward → ${BACKEND_URL}/api/support-bots/webhook/public`);
} else {
  console.warn('⚠️ BACKEND_URL не задан — команды поддержки (/new, /my, /queue) недоступны');
}

const SUPPORT_COMMANDS = new Set(['/new', '/my', '/queue', '/cancel', '/help']);

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

Для доступа к приложению нажмите на синюю кнопку "Открыть портал" внизу.

💻 *С рабочего компьютера:*
Перейдите по ссылке: [entech.p1ck23.ru/auth](https://entech.p1ck23.ru/auth)

🛟 *Техподдержка в этом боте:*
/new — создать заявку
/my — мои заявки
/queue — очередь (для агентов)

Если у вас возникнут вопросы, обращайтесь к администратору.

С уважением,
Команда ENTECH GROUP`;

  try {
    await bot.sendMessage(chatId, welcomeMessage, {
      parse_mode: 'Markdown',
      disable_web_page_preview: false,
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
  const command = text.split(/\s+/)[0]?.split('@')[0] || '';

  if (command === '/start') {
    return;
  }

  const isSupportCommand = SUPPORT_COMMANDS.has(command);
  const isPlainText = Boolean(text) && !text.startsWith('/');

  if (!isSupportCommand && !isPlainText) {
    if (text.startsWith('/')) {
      const chatId = msg.chat.id;
      const helpMessage = `🤖 Доступные команды:

/start — доступ к порталу
/new — новая заявка в техподдержку
/my — мои заявки
/queue — очередь агента
/cancel — отменить черновик заявки

Если у вас есть вопросы, обращайтесь к администратору.`;

      try {
        await bot.sendMessage(chatId, helpMessage);
      } catch (error) {
        console.error(`❌ Ошибка при отправке сообщения:`, error);
      }
    }
    return;
  }

  const ok = await forwardSupportUpdate({ message: msg });
  if (!ok && isSupportCommand) {
    try {
      await bot.sendMessage(
        msg.chat.id,
        'Техподдержка временно недоступна. Попробуйте позже или откройте раздел «Поддержка» на портале.'
      );
    } catch {
      // ignore
    }
  }
});

bot.on('polling_error', (error) => {
  console.error('❌ Ошибка polling:', error);
});

process.on('SIGINT', () => {
  console.log('\n⚠️ Получен сигнал SIGINT, останавливаем бота...');
  bot.stopPolling();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️ Получен сигнал SIGTERM, останавливаем бота...');
  bot.stopPolling();
  process.exit(0);
});

console.log('✅ Бот успешно инициализирован и ожидает команды');
