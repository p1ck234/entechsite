# ENTECH GROUP Telegram Bot

Telegram бот для приветствия пользователей и предоставления информации о доступе к приложению.

## Функциональность

- Обработка команды `/start` с отправкой приветственного сообщения
- Информация о доступе к приложению через Telegram Mini App и веб-версию

## Установка

1. Установите зависимости:
```bash
npm install
```

2. Создайте файл `.env` и добавьте токен бота (тот же бот, что Mini App / вход в портал):
```
BOT_TOKEN=your_bot_token_here
BACKEND_URL=https://your-backend.example.com
```

`BACKEND_URL` нужен для команд техподдержки (`/new`, `/my`, `/queue`) — бот пересылает update на
`POST {BACKEND_URL}/api/support-bots/webhook/public`. На backend тот же `BOT_TOKEN` используется
для ответа пользователю (отдельный `SUPPORT_BOT_PUBLIC_TOKEN` не обязателен).

## Получение токена бота

1. Откройте Telegram и найдите бота [@BotFather](https://t.me/BotFather)
2. Отправьте команду `/newbot`
3. Следуйте инструкциям для создания бота
4. Скопируйте полученный токен и добавьте его в переменную окружения `BOT_TOKEN`

## Разработка

Запуск в режиме разработки:
```bash
npm run dev
```

## Сборка

Сборка проекта:
```bash
npm run build
```

## Запуск

Запуск в production:
```bash
npm start
```

## Деплой на Railway

1. Создайте новый сервис в Railway
2. Подключите репозиторий или загрузите код
3. Установите переменную окружения `BOT_TOKEN` в настройках сервиса
4. Railway автоматически определит проект и задеплоит его

## Структура проекта

```
telegram-bot/
├── src/
│   └── index.ts      # Основной файл бота
├── package.json      # Зависимости проекта
├── tsconfig.json     # Конфигурация TypeScript
├── railway.json      # Конфигурация для Railway
└── README.md         # Документация
```

