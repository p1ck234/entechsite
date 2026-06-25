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
- `sharp@0.34.4` для on-the-fly оптимизации изображений (`/api/uploads/:filename?w=&h=&q=&fit=`); на Railway используется Node 18, поэтому версия зафиксирована (0.35.x требует Node >=20.9)
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
- `backend/src/index.ts`:
  - `GET /api/uploads/:filename` — оптимизация локальных фото через `sharp`;
  - `GET /api/media/proxy?url=...` — прокси Google-изображений для Mini App.

## Task Journal

### 2026-06-25 - Прокси Google-изображений для «Наша жизнь» в Mini App

- Goal: починить пустые превью в разделе «Наша жизнь» в Telegram Mini App, где прямые Google Drive URL не открываются в webview.
- Changes:
  - на backend добавлен `GET /api/media/proxy?url=...` с allowlist Google-хостов, streaming и cache headers;
  - в `imageUtils` для Mini App Google-кандидаты строятся с приоритетом проксированных URL через backend;
  - прямые Google-ссылки оставлены как fallback.
- Files:
  - `backend/src/index.ts`
  - `frontend/src/utils/imageUtils.ts`
- Result: превью событий в Mini App должны грузиться через backend proxy, не завися от Google-аккаунта пользователя в webview.

### 2026-06-25 - Кэш и предзагрузка фото для адресной книги и «Наша жизнь»

- Goal: ускорить повторную загрузку фото после обновления страницы, включить превью в Mini App для «Наша жизнь», убрать лаги веб-версии адресной книги.
- Changes:
  - добавлен модуль `imagePreload.ts`: кэш успешных URL-кандидатов в памяти + `sessionStorage`, очередь предзагрузки с лимитом параллелизма (4), батчевая запись в storage;
  - `ImageWithLoader` использует кэш при повторном рендере и сохраняет рабочий URL после успешной загрузки;
  - в `Employees` и `Life` после получения данных запускается фоновая предзагрузка фото;
  - в `Life.tsx` убрано условие `!isTelegram` — превью снова показываются в Mini App;
  - для превью событий добавлены миниатюры `320x320`, `q=64`;
  - Google URL-кандидаты теперь учитывают целевой размер из `imageOptions`;
  - оптимизация лагов веб-версии: убрана дублирующая предзагрузка из каждого `ImageWithLoader`, ограничены batch/concurrency предзагрузки.
- Files:
  - `frontend/src/utils/imagePreload.ts`
  - `frontend/src/components/ImageWithLoader.tsx`
  - `frontend/src/pages/Employees.tsx`
  - `frontend/src/pages/Life.tsx`
  - `frontend/src/utils/imageUtils.ts`
- Result: фото кэшируются между перерисовками страницы; превью в «Наша жизнь» работают в Mini App; веб-адресная книга не должна подтормаживать из-за агрессивной предзагрузки.

### 2026-06-25 - Fallback URL для фото и фикс деплоя backend из-за sharp

- Goal: повысить устойчивость загрузки фото в Mini App и восстановить деплой backend на Railway.
- Changes:
  - на фронте `getImageUrlCandidates()` возвращает несколько URL для одного фото (upload: оптимизированный + оригинал; Google: несколько форматов);
  - `ImageWithLoader` переключается между кандидатами при `onError`, в инициалы уходит только после провала всех вариантов;
  - добавлен `referrerPolicy="no-referrer"` для внешних изображений;
  - на backend `sharp` загружается лениво через `require()` — при ошибке сервер не падает, отдаёт оригинал;
  - `sharp` зафиксирован на `0.34.4` (совместим с Node 18 на Railway).
- Files:
  - `frontend/src/utils/imageUtils.ts`
  - `frontend/src/components/ImageWithLoader.tsx`
  - `backend/src/index.ts`
  - `backend/package.json`
  - `backend/package-lock.json`
- Result: backend должен проходить healthcheck на Railway; фото в Mini App пробуют несколько URL перед fallback на инициалы.

### 2026-06-25 - Загрузка фото в адресной книге для Mini App и оптимизация аватаров

- Goal: починить отображение фото сотрудников в Telegram Mini App и ускорить загрузку аватаров на сайте.
- Changes:
  - в `imageUtils` относительные пути `/api/uploads/...` приводятся к backend origin (важно для Mini App, где фронт и API на разных доменах);
  - для локальных загрузок добавлены параметры оптимизации (`w/h/q/fit`) в URL изображений;
  - в адресной книге аватары запрашиваются как миниатюры `192x192`, `q=72`;
  - на backend добавлен роут `GET /api/uploads/:filename` с resize/compress через `sharp` и cache headers;
  - для cross-origin загрузки изображений выставлен `Cross-Origin-Resource-Policy: cross-origin`.
- Files:
  - `frontend/src/utils/imageUtils.ts`
  - `frontend/src/components/ImageWithLoader.tsx`
  - `frontend/src/pages/Employees.tsx`
  - `backend/src/index.ts`
  - `backend/package.json`
- Result: фото сотрудников должны грузиться в Mini App; аватары на сайте отдаются меньшим размером и быстрее.

### 2026-06-25 - Периодическая пересинхронизация Telegram в Mini App и веб-версии

- Goal: обеспечить регулярную проверку и обновление Telegram username/telegram_id без полного разлогина и в Mini App, и на сайте.
- Changes:
  - в AuthContext добавлен `syncTelegramAuth(initData)` для фоновой переавторизации через `/auth/telegram`;
  - в AuthContext добавлен `syncTelegramOAuth()` для фоновой переавторизации через `/auth/telegram-oauth` с сохраненными OAuth-данными (без username во избежание отката на устаревшее значение);
  - в странице `TelegramAuth` сохранение payload OAuth в `localStorage` после успешного входа;
  - в Layout добавлен фоновый цикл синхронизации для Mini App:
    - сразу при входе в защищенную зону;
    - каждые 5 минут;
    - при возврате приложения в активный режим (`visibilitychange`).
  - в Layout для веб-версии добавлен тот же цикл синхронизации при наличии сохраненного OAuth payload.
- Files:
  - `frontend/src/contexts/AuthContext.tsx`
  - `frontend/src/components/Layout.tsx`
  - `frontend/src/pages/TelegramAuth.tsx`
  - `frontend/src/api/client.ts`
- Result: даже при живой локальной сессии Telegram-данные регулярно пересинхронизируются в Mini App и на сайте.

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

### 2026-06-25 - Превью «Наша жизнь» пустые в Mini App, на вебе работают

- Symptom: в Mini App карточка мероприятия показывает пустой серый блок вместо фото; на веб-сайте те же превью отображаются.
- Root cause: `previewImages` хранят Google Drive URL; Telegram webview блокирует или не может загрузить прямые Google-ссылки (referrer/CORS/аккаунт).
- Resolution: backend media proxy `/api/media/proxy`; в Mini App Google URL-кандидаты приоритетно идут через прокси backend origin.
- Validation: backend и frontend собираются; требует деплоя backend + frontend для проверки в Mini App.
- Related files: `backend/src/index.ts`, `frontend/src/utils/imageUtils.ts`, `frontend/src/pages/Life.tsx`

### 2026-06-25 - Веб-версия адресной книги подтормаживала после добавления предзагрузки фото

- Symptom: страница «Адресная книга» на вебе ощутимо лагала при вводе/фильтрации; Mini App и другие страницы работали нормально.
- Root cause: агрессивная предзагрузка — каждый `ImageWithLoader` дополнительно запускал preload, плюс синхронная запись всего кэша в `sessionStorage` на каждый успешный `onload`.
- Resolution: предзагрузка централизована в `preloadImages()` с очередью и лимитом параллелизма; запись кэша батчами (~500ms); убран дублирующий preload из компонента картинки.
- Validation: frontend собирается; линтер без ошибок.
- Related files: `frontend/src/utils/imagePreload.ts`, `frontend/src/components/ImageWithLoader.tsx`, `frontend/src/pages/Employees.tsx`

### 2026-06-25 - Railway healthcheck падал из-за sharp на Node 18

- Symptom: деплой backend на Railway завершался с `Healthcheck failed`, в логах `Could not load the "sharp" module`, `Requires >=20.9.0`, `Found 18.20.5`.
- Root cause: `sharp@0.35.2` требует Node >=20.9.0; на Railway backend работает на Node 18.20.5; импорт `sharp` на старте приложения ронял процесс до поднятия `/health`.
- Resolution: downgrade до `sharp@0.34.4`; ленивая загрузка `sharp` внутри роута изображений с fallback на оригинал без оптимизации.
- Validation: backend собирается; `sharp@0.34.4` резолвится и загружается локально.
- Related files: `backend/src/index.ts`, `backend/package.json`, `backend/package-lock.json`

### 2026-06-25 - Фото сотрудников не грузились в Telegram Mini App

- Symptom: в адресной книге Mini App вместо фото показывались инициалы; на веб-сайте фото отображались корректно, но медленно.
- Root cause: в БД фото часто хранятся как относительный путь `/api/uploads/...`; в Mini App запрос шёл на origin фронтенда, где этого маршрута нет. Дополнительно отдавались полноразмерные изображения без оптимизации.
- Resolution: нормализация URL фото к backend origin на фронте; серверная оптимизация через `sharp` с query-параметрами; для аватаров запрашиваются уменьшенные версии; дополнительно — цепочка fallback URL-кандидатов в `ImageWithLoader`.
- Validation: сборка `backend` и `frontend` проходит; линтер без ошибок; ожидает проверки в Mini App после успешного деплоя backend.
- Related files: `frontend/src/utils/imageUtils.ts`, `frontend/src/pages/Employees.tsx`, `backend/src/index.ts`

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

### 2026-06-25 - В Mini App username не обновлялся при валидной локальной сессии

- Symptom: при входе через Mini App старый username мог сохраняться, если пользователь давно не переавторизовывался.
- Root cause: при валидном токене фронт вызывал только `/auth/me`, а синхронизация username выполняется в `/auth/telegram`.
- Resolution: добавлена фоновая переавторизация в Mini App (interval + при возврате вкладки в фокус) без принудительного logout.
- Validation: сборка фронта проходит; синхронизация выполняется в `Layout`.
- Related files: `frontend/src/contexts/AuthContext.tsx`, `frontend/src/components/Layout.tsx`, `backend/src/routes/auth.ts`

### 2026-06-25 - На сайте Telegram username не обновлялся автоматически

- Symptom: в веб-версии после первичного OAuth входа username не пересинхронизировался без повторного ручного логина.
- Root cause: не было фонового вызова Telegram OAuth endpoint и не сохранялись данные OAuth callback для последующих тихих sync-запросов.
- Resolution: сохранение OAuth payload после успешного входа и периодическая фоновая синхронизация в `Layout`.
- Validation: фронтенд собирается, цикл синхронизации активируется при наличии OAuth payload.
- Related files: `frontend/src/pages/TelegramAuth.tsx`, `frontend/src/contexts/AuthContext.tsx`, `frontend/src/components/Layout.tsx`

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

### 2026-06-25 - Нормализация URL фото и серверная оптимизация через sharp

- Context: Mini App и веб работают на разных origin; относительные пути к `/api/uploads` ломают загрузку фото в Mini App; полноразмерные аватары грузятся медленно.
- Decision: на фронте всегда приводить upload-URL к backend origin; на backend отдавать оптимизированные версии по query-параметрам (`w`, `h`, `q`, `fit`) через `sharp`.
- Trade-off: дополнительная CPU-нагрузка на backend при первом запросе каждого размера; компенсируется cache headers.
- Related files: `frontend/src/utils/imageUtils.ts`, `backend/src/index.ts`, `frontend/src/pages/Employees.tsx`

### 2026-06-25 - Ленивая загрузка sharp и fallback URL-кандидаты для изображений

- Context: Railway backend на Node 18; один URL изображения может не работать в Mini App webview (Google Drive, referrer, оптимизированный upload URL).
- Decision: `sharp` загружать лениво и не блокировать старт сервера; на фронте пробовать несколько URL-кандидатов перед показом инициалов; версию `sharp` держать совместимой с Node 18 (`0.34.4`).
- Trade-off: без `sharp` оптимизация отключается, но сервис остаётся доступным; несколько попыток загрузки могут чуть увеличить время до первого успешного рендера.
- Related files: `backend/src/index.ts`, `frontend/src/utils/imageUtils.ts`, `frontend/src/components/ImageWithLoader.tsx`

### 2026-06-25 - Клиентский кэш URL изображений и фоновая предзагрузка

- Context: при обновлении списка сотрудников/событий фото загружались заново; в Mini App «Наша жизнь» превью были отключены.
- Decision: кэшировать успешный URL-кандидат в `sessionStorage` + in-memory Map; предзагружать фото пачкой после API-ответа; не дублировать preload на уровне каждого `<img>`.
- Trade-off: кэш живёт в рамках сессии браузера (не persistent между закрытием вкладки); нужен контроль concurrency, чтобы не перегружать UI thread.
- Related files: `frontend/src/utils/imagePreload.ts`, `frontend/src/pages/Employees.tsx`, `frontend/src/pages/Life.tsx`

### 2026-06-25 - Backend proxy для Google-изображений в Mini App

- Context: курсы, уроки и «Наша жизнь» хранят контент как Google Drive URL; Mini App webview нестабильно грузит прямые ссылки; доступ зависит от Google-аккаунта пользователя.
- Decision: для Google-изображений в Mini App использовать backend proxy с allowlist хостов; прямые ссылки — fallback. Долгосрочно — миграция на object storage.
- Trade-off: proxy добавляет нагрузку на backend и не решает проблему доступа к курсам (только изображения); нужен деплой backend.
- Related files: `backend/src/index.ts`, `frontend/src/utils/imageUtils.ts`

## Open Risks and TODO

- TODO: убрать хардкод fallback `DATABASE_URL` и credentials из кода.
  - Related files: `backend/src/index.ts`, `backend/scripts/add-admin-telegram-oauth.js`
- TODO: синхронизировать документацию, т.к. `README.md` упоминает Prisma, а текущая реализация использует `pg`.
- TODO: рассмотреть единый модуль подключения к БД вместо создания `Pool` в каждом роуте.
- TODO: мигрировать курсы/фото с Google Drive на object storage (S3/R2) — сейчас контент завязан на `google_drive_url`, доступ зависит от Google-аккаунта пользователя.
