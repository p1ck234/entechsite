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
  - `POST /api/upload` — загрузка изображений (multer), возвращает `/api/uploads/<filename>`.
- `backend/src/utils/uploads.ts`:
  - единый путь к папке uploads (`UPLOADS_DIR` или `process.cwd()/uploads`);
  - `resolveUploadedFilePath()` — поиск файла с fallback на legacy-папки.
- `backend/src/index.ts`:
  - `GET /api/uploads/:filename` — оптимизация локальных фото через `sharp`;
  - `GET /api/media/proxy?url=...` — прокси Google-изображений для Mini App (legacy-превью).
- `frontend/src/components/EmployeeModal.tsx`, `EventModal.tsx`:
  - админ загружает фото/превью файлами через `uploadAPI.uploadPhoto()`, без ручного ввода URL.
- `frontend/server.js`:
  - production proxy `/api/*` на backend, чтобы относительные `/api/uploads/...` не попадали в SPA fallback.

## Task Journal

### 2026-06-25 - Upload image candidates для Mini App

- Goal: восстановить отображение upload-фото в Telegram Mini App для адресной книги и «Нашей жизни», когда на web-домене картинки открываются.
- Changes:
  - `frontend/src/utils/imageUtils.ts` теперь строит для `/api/uploads/...` несколько кандидатов:
    - текущий origin Mini App/frontend (`/api/uploads/...`, через frontend proxy);
    - backend/API origin Railway;
    - исходный URL как fallback;
  - в Mini App приоритет отдаётся текущему origin, чтобы не зависеть от прямой загрузки с отдельного Railway backend домена.
  - версия sessionStorage-кэша image candidates поднята до `v2`, чтобы Mini App не держал старый неудачный backend-кандидат.
- Files:
  - `frontend/src/utils/imageUtils.ts`
  - `frontend/src/utils/imagePreload.ts`
  - `frontend/dist/index.html`
- Result: upload-фото сотрудников и preview «Нашей жизни» должны пробовать оба рабочих пути и не падать только из-за недоступности одного origin в webview.

### 2026-06-25 - Fallback для старых preview upload URL

- Goal: починить отображение старых preview-картинок «Нашей жизни» у пользователей без локального кэша.
- Changes:
  - `frontend/src/utils/imageUtils.ts` теперь распознаёт старые значения вида `photo-....jpg/png/webp/gif`;
  - такие значения автоматически нормализуются в `/api/uploads/<filename>` на backend/API origin;
  - это сохраняет поддержку новых `/api/uploads/...` URL и не меняет данные в базе.
- Files:
  - `frontend/src/utils/imageUtils.ts`
  - `frontend/dist/index.html`
- Result: старые preview изображения больше не должны запрашиваться с frontend пути `/photo-...` и падать 404.

### 2026-06-25 - Drive sync для «Нашей жизни»

- Goal: автоматически создавать события «Наша жизнь» из отдельной Google Drive папки без загрузки фото/файлов.
- Changes:
  - добавлен backend `POST /api/drive/sync-life`;
  - root папка берётся из `GOOGLE_DRIVE_ROOT_FOLDER_PHOTO_ID`;
  - sync читает только прямые элементы root папки, сохраняет `title`, `event_date`, `google_drive_url`, пустой `preview_images`;
  - дата парсится из названия и убирается из `title`;
  - upsert выполняется по Drive URL, неизменённые события не трогаются;
  - старые события, созданные этим Drive sync и отсутствующие в папке, скрываются через `is_active=false`;
  - на странице `frontend/src/pages/Life.tsx` добавлена admin-кнопка «Синхронизировать Drive».
- Files:
  - `backend/src/services/googleDrive.ts`
  - `backend/src/routes/drive.ts`
  - `frontend/src/api/client.ts`
  - `frontend/src/pages/Life.tsx`
- Result: Railway нужно задать `GOOGLE_DRIVE_ROOT_FOLDER_PHOTO_ID`; sync будет подтягивать только названия, даты и ссылки.

### 2026-06-25 - Возврат простой link-only синхронизации Drive

- Goal: автоматически добавлять курсы/уроки из Google Drive, но сохранять их как обычные `googleDriveUrl` ссылки без файлового proxy/preview.
- Changes:
  - возвращён backend `POST /api/drive/sync-training`;
  - sync читает папку «Обучение» через service account и upsert курсов/уроков по стабильным Drive URL;
  - подпапки первого уровня = курсы, прямые подпапки курса = уроки с обычными ссылками на папки Google Drive;
  - если в курсе нет прямых подпапок, уроками становятся прямые файлы курса с обычными Google Drive ссылками;
  - файлы внутри папок-уроков и вложенность глубже уровня урока не синхронизируются;
  - после sync активными остаются только актуальные уроки по этому правилу, старые лишние уроки скрываются через `is_active=false`;
  - frontend снова показывает кнопку «Синхронизировать Drive» для admin;
  - не возвращались `materials JSONB`, portal popup, streaming endpoint и перенос прогресса.
- Files:
  - `backend/src/services/googleDrive.ts`
  - `backend/src/routes/drive.ts`
  - `backend/src/index.ts`
  - `backend/package.json`
  - `frontend/src/api/client.ts`
  - `frontend/src/pages/Courses.tsx`
- Result: можно автоматически наполнить базу знаний из Drive папками-курсами и папками-уроками; для курсов без подпапок поддерживается fallback на прямые файлы.

### 2026-06-25 - Откат Google Drive sync для обучения

- Goal: вернуть ручное заполнение курсов и уроков ссылками Google Drive, убрать автоматическую синхронизацию папки «Обучение».
- Changes:
  - удалены backend route/service синхронизации Drive (`/api/drive/sync-training`, streaming материалов, service account traversal);
  - из frontend убраны кнопка «Синхронизировать Drive», материалы урока, popup preview и связанная логика;
  - `googleapis` удалён из backend dependencies;
  - схема уроков возвращена без `materials JSONB`;
  - защита `credentials.json` оставлена в `.gitignore`, чтобы секреты не попадали в git.
- Files:
  - `backend/src/routes/drive.ts`
  - `backend/src/services/googleDrive.ts`
  - `backend/src/index.ts`
  - `backend/src/utils/db-init.ts`
  - `backend/package.json`
  - `frontend/src/api/client.ts`
  - `frontend/src/pages/Courses.tsx`
  - `frontend/src/types/index.ts`
  - `.gitignore`
- Result: курсы и уроки снова управляются вручную через существующие формы и `googleDriveUrl`; автоматической синхронизации с Google Drive больше нет.
- Note: неудачной признана сложная схема с `materials`, popup/preview, streaming endpoint и переносом прогресса. Простая link-only синхронизация Drive допустима.

### 2026-06-25 - Frontend proxy для `/api/uploads` на production-домене

- Goal: починить `ERR_BLOCKED_BY_ORB` и `404 text/html` для URL вида `https://entech.p1ck23.ru/api/uploads/photo-....jpg`.
- Changes:
  - в `frontend/server.js` добавлен proxy `app.use('/api', ...)` до `express.static` и SPA fallback;
  - proxy перенаправляет `/api/*` на backend (`API_PROXY_TARGET` или production Railway backend);
  - это защищает относительные upload URL, даже если фронт не переписал их на backend origin.
- Files:
  - `frontend/server.js`
- Result: `/api/uploads/...` на frontend-домене больше не должен возвращать HTML/SPA и блокироваться браузером как ORB; запрос должен доходить до backend.

### 2026-06-25 - Единый путь uploads: upload и раздача `/api/uploads`

- Goal: починить ситуацию, когда фото загружаются через форму, URL сохраняется в БД, но картинка не открывается ни в «Наша жизнь», ни в адресной книге (веб и Mini App).
- Changes:
  - добавлен `backend/src/utils/uploads.ts`: `getUploadsDir()`, `ensureUploadsDir()`, `resolveUploadedFilePath()`;
  - каноническая папка: `UPLOADS_DIR` или `process.cwd()/uploads` (не `dist/uploads` vs `backend/uploads` по-разному);
  - `upload.ts` и `index.ts` используют один helper для сохранения и отдачи файлов;
  - при чтении — fallback-поиск в legacy-папках (`dist/uploads`, `backend/uploads`).
- Files:
  - `backend/src/utils/uploads.ts`
  - `backend/src/routes/upload.ts`
  - `backend/src/index.ts`
- Result: после деплоя backend новые upload-фото должны открываться по `/api/uploads/...`. Файлы, загруженные до фикса в «не ту» папку, могут потребовать перезагрузки через форму.

### 2026-06-25 - Загрузка фото файлами в адресной книге и «Наша жизнь»

- Goal: убрать ручной ввод URL для фото/превью в админ-формах; хранить изображения на backend как `/api/uploads/...`, чтобы они стабильно открывались в Mini App (как уже работающие аватары).
- Changes:
  - в `EmployeeModal` поле `URL фото` заменено на `<input type="file">` + предпросмотр и удаление;
  - в `EventModal` убран ввод URL превью, оставлена только загрузка файлов (multiple);
  - в `UserModal` (legacy) синхронизирован тот же паттерн загрузки;
  - используется существующий `uploadAPI.uploadPhoto()` → `POST /api/upload`.
- Files:
  - `frontend/src/components/EmployeeModal.tsx`
  - `frontend/src/components/EventModal.tsx`
  - `frontend/src/components/UserModal.tsx`
  - `frontend/src/api/client.ts` (`uploadAPI`)
  - `backend/src/routes/upload.ts`
- Result: новые/обновлённые фото и превью сохраняются на сервере; Google/lh3 URL больше не вводятся через UI. Старые записи с внешними ссылками нужно перезалить через редактирование.

### 2026-06-25 - Устойчивая загрузка превью «Наша жизнь» в Mini App (lh3/google)

- Goal: убрать бесконечную загрузку превью в Mini App для ссылок вида `lh3.google.com/u/0/d/...`, привести UX к логике адресной книги.
- Changes:
  - в `imageUtils` для Mini App переставлен порядок Google-кандидатов: сначала proxy и id-based URL (`thumbnail`, `uc`, `drive.usercontent`), исходный `lh3` — в конце;
  - в `ImageWithLoader` добавлен таймаут кандидата (7s) и автопереход к следующему URL при зависании;
  - в `Life.tsx` добавлен `EventPreviewTile` с fallback-иконкой вместо пустого серого блока при полном фейле.
- Files:
  - `frontend/src/utils/imageUtils.ts`
  - `frontend/src/components/ImageWithLoader.tsx`
  - `frontend/src/pages/Life.tsx`
- Result: Mini App не зависает на одном Google URL; при недоступном файле показывается placeholder, а не вечный спиннер.

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

### 2026-06-25 - `/api/uploads` на frontend-домене возвращал HTML и блокировался ORB

- Symptom: Network показывает `net::ERR_BLOCKED_BY_ORB`, `404 text/html` для `https://entech.p1ck23.ru/api/uploads/photo-....jpg`, хотя URL выглядит как backend upload.
- Root cause: относительный `/api/uploads/...` попадал на frontend server; SPA fallback/404 отдавал HTML вместо image, браузер блокировал ответ как ORB.
- Resolution: production frontend server проксирует `/api/*` на backend до обработки статики и SPA fallback.
- Validation: `node --check frontend/server.js` и frontend build проходят.
- Related files: `frontend/server.js`

### 2026-06-25 - Upload сохранял файл, но `/api/uploads` отдавал 404

- Symptom: после загрузки фото через форму в «Наша жизнь» и адресной книге в БД лежит `/api/uploads/photo-....jpg`, но на вебе и в Mini App показываются заглушки/инициалы.
- Root cause: `upload.ts` и `index.ts` вычисляли `uploadsDir` по-разному (`__dirname` + production/dev), файл сохранялся в одну директорию, а `GET /api/uploads/:filename` искал в другой.
- Resolution: общий модуль `utils/uploads.ts`; канонический путь `process.cwd()/uploads` (или `UPLOADS_DIR`); `resolveUploadedFilePath()` с fallback на legacy-папки.
- Validation: backend собирается; требует деплоя backend; старые файлы из «не той» папки — перезалить.
- Related files: `backend/src/utils/uploads.ts`, `backend/src/routes/upload.ts`, `backend/src/index.ts`

### 2026-06-25 - Google URL в админ-формах не работают в Mini App

- Symptom: превью «Наша жизнь» и фото сотрудников не отображаются в Mini App, хотя на вебе иногда видны; в формах админ вводил `lh3.google.com/...` или другие внешние URL.
- Root cause: внешние Google-ссылки требуют авторизации и нестабильны в Telegram webview; адресная книга работала там, где в БД уже лежали `/api/uploads/...` с backend.
- Resolution: в `EmployeeModal` и `EventModal` убран ручной ввод URL; фото/превью загружаются файлами через `POST /api/upload` и сохраняются как `/api/uploads/<filename>`.
- Validation: frontend собирается; линтер без ошибок; старые записи с Google URL нужно перезалить через редактирование.
- Related files: `frontend/src/components/EmployeeModal.tsx`, `frontend/src/components/EventModal.tsx`, `backend/src/routes/upload.ts`

### 2026-06-25 - Превью «Наша жизнь» зависают в Mini App на Google lh3-ссылках

- Symptom: в Mini App превью «крутятся» бесконечно и не показываются; на вебе те же карточки отображаются; пример URL: `lh3.google.com/u/0/d/<fileId>=w2000-h2166-iv1`.
- Root cause: такие ссылки часто редиректят в Google Sign-In, а не в image endpoint; `ImageWithLoader` ждал `onload/onerror`, которых webview может не прислать; в `Life` не было fallback-плитки как в адресной книге.
- Resolution: приоритет proxy/id-based кандидатов в Mini App; таймаут переключения кандидата; fallback-иконка в `EventPreviewTile`.
- Validation: frontend собирается; линтер без ошибок; для приватных Drive-файлов загрузка всё равно может не сработать без object storage.
- Related files: `frontend/src/utils/imageUtils.ts`, `frontend/src/components/ImageWithLoader.tsx`, `frontend/src/pages/Life.tsx`

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

### 2026-06-25 - Таймаут и fallback-плитки для Google-превью в Mini App

- Context: `lh3.google.com/u/0/d/...` может не вызывать `onerror` в webview и зависать в вечной загрузке; в «Наша жизнь» не было fallback как в адресной книге.
- Decision: в Mini App сначала пробовать proxy/id-based Google URL; в `ImageWithLoader` переключать кандидат по таймауту (7s); в `Life` показывать placeholder-иконку после исчерпания кандидатов.
- Trade-off: до 7s на каждый неудачный кандидат увеличивает worst-case время; зато UI не зависает бесконечно.
- Related files: `frontend/src/utils/imageUtils.ts`, `frontend/src/components/ImageWithLoader.tsx`, `frontend/src/pages/Life.tsx`

### 2026-06-25 - Фото сотрудников и превью событий — только через backend upload

- Context: внешние URL (Google Drive, lh3) не подходят для Mini App; рабочий путь — `/api/uploads/...` с backend origin и sharp-оптимизацией.
- Decision: в админ-формах (`EmployeeModal`, `EventModal`) загрузка только файлами через `uploadAPI`; ручной ввод URL убран. Google Drive URL остаётся только для ссылки на альбом/материал (`googleDriveUrl`), не для превью-картинок.
- Trade-off: нужно перезалить legacy-записи с внешними URL; диск backend/Railway хранит файлы (лимит upload 5MB).
- Related files: `frontend/src/components/EmployeeModal.tsx`, `frontend/src/components/EventModal.tsx`, `backend/src/routes/upload.ts`, `frontend/src/api/client.ts`

### 2026-06-25 - Каноническая папка uploads на backend

- Context: после перехода на file upload фото всё равно не открывались — upload и serve смотрели в разные директории; на Railway пути зависят от `cwd` и сборки в `dist/`.
- Decision: один модуль `utils/uploads.ts`; сохранение и раздача через `ensureUploadsDir()` / `resolveUploadedFilePath()`; override через env `UPLOADS_DIR` при необходимости persistent volume на Railway.
- Trade-off: без persistent volume на Railway файлы могут теряться при redeploy; legacy fallback не спасёт файлы, уже записанные только в ephemeral-папку.
- Related files: `backend/src/utils/uploads.ts`, `backend/src/routes/upload.ts`, `backend/src/index.ts`

### 2026-06-25 - `/api` proxy на frontend server как production safety net

- Context: даже при корректной нормализации URL часть ссылок может оставаться относительной `/api/uploads/...`; на кастомном домене это попадает в frontend service.
- Decision: `frontend/server.js` обязан проксировать `/api/*` на backend перед SPA fallback. Target задаётся `API_PROXY_TARGET`, default — production backend Railway.
- Trade-off: лишний hop через frontend для относительных API URL; зато отсутствует HTML fallback для image/API запросов.
- Related files: `frontend/server.js`, `frontend/src/config/api.ts`

## Open Risks and TODO

- TODO: убрать хардкод fallback `DATABASE_URL` и credentials из кода.
  - Related files: `backend/src/index.ts`, `backend/scripts/add-admin-telegram-oauth.js`
- TODO: синхронизировать документацию, т.к. `README.md` упоминает Prisma, а текущая реализация использует `pg`.
- TODO: рассмотреть единый модуль подключения к БД вместо создания `Pool` в каждом роуте.
- TODO: мигрировать курсы/фото с Google Drive на object storage (S3/R2) — сейчас контент завязан на `google_drive_url`, доступ зависит от Google-аккаунта пользователя.
- TODO: перезалить legacy-записи с внешними URL в `employees.photo` и `events.preview_images` через админ-формы с file upload.
- TODO: на Railway подключить persistent volume и задать `UPLOADS_DIR`, иначе upload-файлы пропадают при redeploy.
