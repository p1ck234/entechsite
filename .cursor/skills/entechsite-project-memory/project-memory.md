# EnTechSite - Project Memory

## Project Summary

- Корпоративный портал + Telegram Mini App для сотрудников.
- Основные блоки: авторизация через Telegram, адресная книга, обучение (курсы/уроки), раздел "Наша жизнь" (фото/мероприятия), календарь, список ботов/сайтов.
- Основной рабочий домен: внутренний портал компании.

## Architecture

- Монорепа:
  - `frontend` - клиентское приложение.
  - `backend` - REST API + бизнес-логика.
  - `telegram-bot` - Telegram бот для входной точки пользователей.
  - корень - оркестрация запуска/сборки.
- Запуск локально:
  - корневой `npm run dev` поднимает `frontend` и `backend`.
- Деплой:
  - Railway конфиги в `railway.json`, `frontend/railway.json`, `backend/railway.json`, `telegram-bot/railway.json`.

## Stack and Dependencies

### Root

- `concurrently`

### Frontend (`frontend/package.json`)

- React 18, TypeScript, Vite
- Tailwind CSS, PostCSS, Autoprefixer
- React Router DOM
- Axios
- Lucide React
- `clsx`, `tailwind-merge`
- Линтинг: ESLint + `@typescript-eslint/*`
- Дополнительно: `express` для статической раздачи сборки (`frontend/server.js`)

### Backend (`backend/package.json`)

- Node.js + Express + TypeScript
- PostgreSQL через `pg` (без Prisma в текущей реализации)
- `jsonwebtoken`, `bcryptjs`
- `express-validator`, `helmet`, `cors`, `express-rate-limit`
- `multer` для загрузки файлов
- `dotenv`

### Telegram Bot (`telegram-bot/package.json`)

- `node-telegram-bot-api`
- TypeScript
- `dotenv`

## Feature Map

- `backend/src/routes/auth.ts`:
  - login/password, Telegram Mini App login, Telegram OAuth login, Telegram registration.
- `backend/src/routes/employees.ts`:
  - адресная книга, фильтры, роли, soft-delete/restore.
- `backend/src/routes/users.ts`:
  - админ-операции и модерация заявок (`PENDING/APPROVED/REJECTED`).
- `backend/src/routes/courses.ts`, `backend/src/routes/lessons.ts`:
  - курсы, уроки, прогресс обучения.
- `backend/src/routes/events.ts`:
  - раздел "Наша жизнь", материалы и превью-изображения.
- `backend/src/routes/calendar.ts`:
  - календарь мероприятий.
- `backend/src/routes/bots.ts`:
  - Telegram боты и сайты.
- `backend/src/routes/upload.ts`:
  - загрузка изображений.

## Task Journal

### 2026-06-25 - Стабилизация Telegram входа и единого формата username

- Goal: убрать зависимость входа от изменяемого `username`, перейти на `telegram_id` и унифицировать отображение Telegram в адресной книге.
- Changes:
  - в `auth` логине добавлен приоритет поиска сотрудника по `telegram_id`;
  - добавлена синхронизация `telegram_id` и `telegram username` при каждом входе;
  - username нормализуется в lowercase без `@` при сохранении/обновлении сотрудника;
  - на фронте отображение в адресной книге приведено к виду `@username` (lowercase).
- Files:
  - `backend/src/routes/auth.ts`
  - `backend/src/routes/employees.ts`
  - `backend/src/routes/users.ts`
  - `frontend/src/pages/Employees.tsx`
- Result: смена username в адресной книге больше не должна ломать вход, данные профиля синхронизируются при логине.

### 2026-06-25 - Первичное исследование и создание project skill

- Goal: собрать карту проекта и оформить скилл для ведения живой техпамяти.
- Changes:
  - проанализирована структура, стек, роуты, страницы, инфраструктурные скрипты;
  - создан project skill и базовый memory-файл.
- Files:
  - `.cursor/skills/entechsite-project-memory/SKILL.md`
  - `.cursor/skills/entechsite-project-memory/project-memory.md`
- Result: есть единая точка для фиксации контекста, прогресса и решений.

## Problems and Resolutions

### 2026-06-25 - CORS и preflight в Telegram/веб окружении

- Symptom: проблемы с запросами из разных origin (включая Telegram окружения).
- Root cause: сложный набор origin и чувствительность к порядку middleware.
- Resolution: явная обработка `OPTIONS`, нормализация origin, CORS до `helmet`.
- Validation: защитная логика и подробный логинг реализованы в сервере.
- Related files: `backend/src/index.ts`

### 2026-06-25 - Нестабильный `DATABASE_URL` в Railway

- Symptom: бэкенд может стартовать без корректного `DATABASE_URL`.
- Root cause: переменные окружения зависят от конфигурации сервиса Railway.
- Resolution: fallback-сборка URL из `PG*`, поиск альтернативных переменных, скрипт диагностики.
- Validation: реализованы проверки и диагностические логи.
- Related files: `backend/src/index.ts`, `backend/scripts/check-env.js`

### 2026-06-25 - Рассинхрон Telegram идентификаторов

- Symptom: пользователь может не находиться при входе из-за формата username.
- Root cause: в данных встречаются варианты `@username`, `username`, `telegram_id`.
- Resolution: нормализация username и поиск по нескольким вариантам + `telegram_id`.
- Validation: логика поиска и обновления полей реализована в auth-роутах.
- Related files: `backend/src/routes/auth.ts`, `backend/src/utils/db-init.ts`

### 2026-06-25 - Логин ломался после смены username в адресной книге

- Symptom: пользователь терял возможность входа после ручного изменения `telegram` в карточке сотрудника.
- Root cause: в Mini App логине поиск сотрудника опирался на `telegram username`, который может меняться.
- Resolution: перевели matching на приоритет `telegram_id`, сохранили fallback и добавили авто-синхронизацию username при логине.
- Validation: сборка `backend` и `frontend` проходит; логика синхронизации централизована в `auth` роуте.
- Related files: `backend/src/routes/auth.ts`, `backend/src/routes/employees.ts`, `frontend/src/pages/Employees.tsx`

### 2026-06-25 - Дрейф схемы `telegram_id`

- Symptom: в старых БД тип `telegram_id` может быть не `BIGINT`.
- Root cause: исторические изменения схемы без единых миграций.
- Resolution: проверка типа колонки и приведение к `BIGINT` при инициализации.
- Validation: автоматическая проверка и исправление в init логике БД.
- Related files: `backend/src/utils/db-init.ts`

### 2026-06-25 - Битые ссылки на assets после сборки фронта

- Symptom: `index.html` может ссылаться на несуществующие hash-файлы.
- Root cause: рассинхрон между именами ассетов и ссылками в `index.html`.
- Resolution: post-build скрипт фикса + runtime-подстраховка в web server.
- Validation: реализованы скрипт и дополнительные проверки при старте.
- Related files: `frontend/fix-index.js`, `frontend/server.js`

### 2026-06-25 - Конфликт OAuth widget и Telegram Mini App

- Symptom: OAuth widget некорректен в Mini App сценарии.
- Root cause: разные механики авторизации для браузера и Mini App.
- Resolution: разделение потоков входа (`/auth` для веб, `/login` для Mini App).
- Validation: в UI добавлены проверки окружения и отдельная логика.
- Related files: `frontend/src/pages/TelegramAuth.tsx`, `frontend/src/pages/Login.tsx`, `frontend/src/pages/Home.tsx`

## Decisions

### 2026-06-25 - Регистрация новых пользователей через Telegram с модерацией

- Context: нужен контролируемый доступ в корпоративный портал.
- Decision: использовать заявки со статусами `PENDING/APPROVED/REJECTED`, решение принимает администратор.
- Trade-off: дополнительный шаг для пользователя, но выше контроль доступа.
- Related files: `backend/src/routes/auth.ts`, `backend/src/routes/users.ts`, `frontend/src/pages/Employees.tsx`

### 2026-06-25 - Хранить Telegram username нормализованным (без `@`)

- Context: единообразный поиск и исключение дублей.
- Decision: нормализовать username и учитывать варианты при поиске.
- Trade-off: нужна явная нормализация в нескольких местах.
- Related files: `backend/src/routes/auth.ts`, `backend/src/routes/bots.ts`, `backend/scripts/reset-db.js`

### 2026-06-25 - Авторизация сотрудника привязана к `telegram_id`

- Context: username может изменяться и не подходит как стабильный идентификатор входа.
- Decision: использовать `telegram_id` как основной ключ матчинга в Telegram логине, username считать синхронизируемым атрибутом профиля.
- Trade-off: требуется поддерживать обратную совместимость со старыми записями, где `telegram_id` еще не заполнен.
- Related files: `backend/src/routes/auth.ts`, `backend/src/routes/employees.ts`

## Open Risks and TODO

- TODO: убрать хардкод fallback `DATABASE_URL` и credentials из кода.
  - Related files: `backend/src/index.ts`, `backend/scripts/add-admin-telegram-oauth.js`
- TODO: синхронизировать документацию, т.к. `README.md` упоминает Prisma, а текущая реализация использует `pg`.
- TODO: рассмотреть единый модуль подключения к БД вместо создания `Pool` в каждом роуте.
