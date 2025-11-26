# Деплой на Railway

## Быстрый старт

### 1. Создайте аккаунт на Railway
- Перейдите на https://railway.app
- Войдите через GitHub

### 2. Создайте новый проект
- Нажмите "New Project"
- Выберите "Deploy from GitHub repo"
- Выберите ваш репозиторий (или создайте новый)

### 3. Настройте Backend

1. **Добавьте PostgreSQL:**
   - В проекте нажмите "+ New"
   - Выберите "Database" → "PostgreSQL"
   - Railway автоматически создаст базу

2. **Добавьте Backend сервис:**
   - Нажмите "+ New" → "GitHub Repo"
   - Выберите ваш репозиторий
   - Выберите папку `backend`
   - Railway автоматически определит Node.js

3. **Настройте переменные окружения:**
   - В настройках backend сервиса → "Variables"
   - Добавьте:
     ```
     DATABASE_URL=${{Postgres.DATABASE_URL}}
     JWT_SECRET=ваш-секретный-ключ-32-символа
     NODE_ENV=production
     PORT=3001
     ```
   - `DATABASE_URL` автоматически подключится к PostgreSQL

4. **Настройте команды запуска:**
   - В настройках → "Settings" → "Deploy"
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`

### 4. Настройте Frontend

1. **Добавьте Frontend сервис:**
   - Нажмите "+ New" → "GitHub Repo"
   - Выберите тот же репозиторий
   - Выберите папку `frontend`

2. **Настройте переменные окружения:**
   ```
   VITE_API_URL=https://ваш-backend-url.railway.app/api
   ```

3. **Настройте команды:**
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run preview` (или настройте статический хостинг)

### 5. Получите домены

- Railway автоматически выдаст домены:
  - Backend: `ваш-проект-backend.railway.app`
  - Frontend: `ваш-проект-frontend.railway.app`

### 6. Обновите CORS в backend

В `backend/src/index.ts` добавьте Railway домен:
```typescript
origin: [
  'https://ваш-проект-frontend.railway.app',
  'https://entech.p1ck23.ru',
  // ...
]
```

### 7. Настройте Telegram Bot

В BotFather укажите URL frontend:
```
https://ваш-проект-frontend.railway.app
```

Или используйте свой домен (если подключите к Railway).

## Альтернатива: Render

### Backend на Render:

1. Создайте аккаунт на https://render.com
2. "New" → "Web Service"
3. Подключите GitHub репозиторий
4. Настройки:
   - Build Command: `cd backend && npm install && npm run build`
   - Start Command: `cd backend && npm start`
5. Добавьте PostgreSQL через "New" → "PostgreSQL"
6. Переменные окружения:
   ```
   DATABASE_URL=<из Render PostgreSQL>
   JWT_SECRET=ваш-ключ
   NODE_ENV=production
   ```

### Frontend на Render:

1. "New" → "Static Site"
2. Подключите репозиторий
3. Build Command: `cd frontend && npm install && npm run build`
4. Publish Directory: `frontend/dist`

## Или: Vercel (Frontend) + Railway (Backend)

- Frontend на Vercel (отличный для React)
- Backend на Railway
- Просто и бесплатно

