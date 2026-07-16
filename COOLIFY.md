# Деплой в Coolify

Проект разворачивается как два отдельных приложения из одного Git-репозитория.

## Frontend

- Build Pack: `Dockerfile`
- Base Directory: `/frontend`
- Dockerfile Location: `/Dockerfile` (относительно Base Directory)
- Domain: `https://entech.p1ck23.ru`
- Exposed Port: `3000`
- Healthcheck Path: `/health`

Переменные:

```env
PORT=3000
NODE_ENV=production
API_PROXY_TARGET=https://api.entech.p1ck23.ru
VITE_API_URL=https://api.entech.p1ck23.ru
VITE_TELEGRAM_BOT_NAME=entechsite_bot
```

`VITE_*` переменные являются build-time переменными. Значение `VITE_API_URL`
можно указывать как с `/api`, так и без него.

## Backend

- Build Pack: `Dockerfile`
- Base Directory: `/backend`
- Dockerfile Location: `/Dockerfile` (относительно Base Directory)
- Domain: `https://api.entech.p1ck23.ru`
- Exposed Port: `3001`
- Healthcheck Path: `/health`

Минимальные переменные:

```env
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://entech.p1ck23.ru
DATABASE_URL=postgresql://...
JWT_SECRET=...
```

Также перенесите используемые интеграциями секреты: Google service account,
ID папок Drive, Telegram/Todoist tokens.

## Загруженные изображения

Для backend обязательно подключите Persistent Storage:

- Destination Path: `/app/uploads`

Без persistent volume фотографии сотрудников и preview «Нашей жизни» будут
теряться после пересборки контейнера.

## Первый деплой после миграции

1. Выполните redeploy backend.
2. Убедитесь, что `https://api.entech.p1ck23.ru/health` возвращает JSON.
3. Выполните frontend redeploy с отключённым build cache.
4. Убедитесь, что запрос `/assets/index-*.js` возвращает
   `Content-Type: application/javascript`, а не `text/html`.

Frontend должен запускаться командой из Dockerfile (`npm start`), а не как
отдельный static SPA build pack. Docker-сборка формирует `index.html` и
hashed assets в одном слое, поэтому ссылки на JS не расходятся.
