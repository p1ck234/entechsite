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

2. Создайте файл `.env`:
```
BOT_TOKEN=токен_портального_бота
BACKEND_URL=https://your-backend.example.com

# Опционально — отдельный бот раздела «Служебная»
SUPPORT_BOT_SHADOW_TOKEN=токен_служебного_бота
```

`BACKEND_URL` нужен для техподдержки:
- публичный бот → `POST …/api/support-bots/webhook/public`
- служебный бот → `POST …/api/support-bots/webhook/shadow`

На backend нужны те же токены: `BOT_TOKEN` (или public) и `SUPPORT_BOT_SHADOW_TOKEN`.

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

Отдельный сервис для служебного бота **не нужен**. Один сервис `entechsite telegram-bot`
слушает оба токена.

1. Root Directory: `telegram-bot`
2. Variables:
   - `BOT_TOKEN` — портальный бот (вход / публичная поддержка)
   - `SUPPORT_BOT_SHADOW_TOKEN` — бот `@etgsupportbot` (Служебная)
   - `BACKEND_URL` — URL backend (например `https://entechsite-backend-production.up.railway.app`)
3. После деплоя в логах должно быть:
   - `[public] polling: @...`
   - `[shadow] polling: @etgsupportbot`
4. Если строки `[shadow]` нет — переменная `SUPPORT_BOT_SHADOW_TOKEN` не задана **на сервисе telegram-bot**
   (только на backend недостаточно).

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

