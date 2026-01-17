import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';

dotenv.config();

// Получаем токен бота из переменных окружения
const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ Ошибка: BOT_TOKEN не установлен в переменных окружения');
  console.error('💡 Установите переменную BOT_TOKEN в Railway или в файле .env');
  process.exit(1);
}

// Создаем экземпляр бота
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('🤖 Telegram бот запущен и готов к работе');

// Обработка команды /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from?.first_name || 'Пользователь';

  console.log(`📨 Получена команда /start от пользователя ${firstName} (ID: ${chatId})`);

  // Приветственное сообщение
  const welcomeMessage = `👋 Добро пожаловать в ENTECH GROUP, ${firstName}!

Мы рады вас видеть! 🎉

Для доступа к приложению нажмите на синюю кнопку "Открыть портал" внизу.

💻 *С рабочего компьютера:*
Перейдите по ссылке: [entech.p1ck23.ru/auth](https://entech.p1ck23.ru/auth)

Если у вас возникнут вопросы, обращайтесь к администратору.

С уважением,
Команда ENTECH GROUP`;

  try {
    await bot.sendMessage(chatId, welcomeMessage, {
      parse_mode: 'Markdown',
      disable_web_page_preview: false
    });
    console.log(`✅ Приветственное сообщение отправлено пользователю ${firstName} (ID: ${chatId})`);
  } catch (error) {
    console.error(`❌ Ошибка при отправке сообщения пользователю ${chatId}:`, error);
  }
});

// Обработка ошибок
bot.on('polling_error', (error) => {
  console.error('❌ Ошибка polling:', error);
});

// Обработка неизвестных команд
bot.on('message', async (msg) => {
  // Пропускаем команду /start, она обрабатывается отдельно
  if (msg.text?.startsWith('/start')) {
    return;
  }

  // Если это текстовая команда (начинается с /), отправляем сообщение о помощи
  if (msg.text?.startsWith('/')) {
    const chatId = msg.chat.id;
    const helpMessage = `🤖 Доступные команды:

/start - Начать работу с ботом и получить информацию о доступе к приложению

Если у вас есть вопросы, обращайтесь к администратору.`;

    try {
      await bot.sendMessage(chatId, helpMessage);
    } catch (error) {
      console.error(`❌ Ошибка при отправке сообщения:`, error);
    }
  }
});

// Graceful shutdown
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

