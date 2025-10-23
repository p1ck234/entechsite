# EnTech - Система управления компанией

Современная платформа для управления сотрудниками и образовательными курсами компании.

**🌐 Сайт**: https://entech.p1ck23.ru

## 🚀 Возможности

- **Система авторизации** с ролями (Администратор/Пользователь)
- **Адресная книга сотрудников** с полной контактной информацией
- **Система курсов** с интеграцией Google Drive
- **Отслеживание прогресса** обучения
- **Современный UI** в пастельных тонах с эффектами прозрачности
- **Адаптивный дизайн** для всех устройств

## 🛠 Технологический стек

### Backend
- Node.js + Express + TypeScript
- PostgreSQL + Prisma ORM
- JWT аутентификация
- bcrypt для хеширования паролей

### Frontend
- React + TypeScript
- Vite для сборки
- Tailwind CSS для стилизации
- React Router для навигации
- Axios для HTTP запросов

## 📋 Требования

- Node.js 18+
- PostgreSQL 13+
- npm или yarn

## 🚀 Установка и запуск

### 1. Клонирование и установка зависимостей

```bash
# Установка зависимостей для корневого проекта
npm install

# Установка зависимостей для бекенда
cd backend
npm install

# Установка зависимостей для фронтенда
cd ../frontend
npm install
```

### 2. Настройка базы данных

```bash
# Создайте базу данных PostgreSQL
createdb entechsite

# Настройте переменные окружения
cd backend
cp env.example .env

# Отредактируйте .env файл:
# DATABASE_URL="postgresql://username:password@localhost:5432/entechsite"
# JWT_SECRET="your-super-secret-jwt-key-here"
# PORT=3001
# NODE_ENV="development"
```

### 3. Инициализация базы данных

```bash
cd backend

# Генерация Prisma клиента
npm run db:generate

# Применение миграций
npm run db:push

# (Опционально) Открыть Prisma Studio для просмотра данных
npm run db:studio
```

### 4. Запуск приложения

```bash
# Из корневой директории проекта
npm run dev
```

Это запустит:
- Backend на http://localhost:3001
- Frontend на http://localhost:5173

### Альтернативный запуск

```bash
# Запуск только бекенда
cd backend
npm run dev

# Запуск только фронтенда (в отдельном терминале)
cd frontend
npm run dev
```

## 📁 Структура проекта

```
entechsite/
├── backend/                 # Backend приложение
│   ├── src/
│   │   ├── routes/         # API маршруты
│   │   ├── middleware/     # Middleware функции
│   │   └── index.ts        # Главный файл сервера
│   ├── prisma/
│   │   └── schema.prisma   # Схема базы данных
│   └── package.json
├── frontend/               # Frontend приложение
│   ├── src/
│   │   ├── components/     # React компоненты
│   │   ├── pages/         # Страницы приложения
│   │   ├── contexts/      # React контексты
│   │   ├── api/           # API клиент
│   │   └── types/         # TypeScript типы
│   └── package.json
└── package.json           # Корневой package.json
```

## 🔐 Роли пользователей

### Администратор
- Полный доступ ко всем функциям
- Управление сотрудниками (создание, редактирование, удаление)
- Управление курсами (создание, редактирование, удаление)
- Просмотр всех пользователей

### Пользователь
- Просмотр адресной книги сотрудников
- Доступ к курсам
- Отслеживание прогресса обучения
- Управление собственным профилем

## 🎨 Дизайн

Приложение использует современный дизайн с:
- Пастельными тонами
- Эффектами прозрачности (glass morphism)
- Адаптивной версткой
- Плавными анимациями
- Красным акцентным цветом для логотипа

## 📱 API Endpoints

### Аутентификация
- `POST /api/auth/login` - Вход в систему
- `POST /api/auth/register` - Регистрация
- `GET /api/auth/me` - Текущий пользователь

### Сотрудники
- `GET /api/employees` - Список сотрудников
- `GET /api/employees/:id` - Сотрудник по ID
- `POST /api/employees` - Создание сотрудника (Admin)
- `PUT /api/employees/:id` - Обновление сотрудника (Admin)
- `DELETE /api/employees/:id` - Удаление сотрудника (Admin)

### Курсы
- `GET /api/courses` - Список курсов
- `GET /api/courses/:id` - Курс по ID
- `POST /api/courses` - Создание курса (Admin)
- `PUT /api/courses/:id` - Обновление курса (Admin)
- `DELETE /api/courses/:id` - Удаление курса (Admin)
- `POST /api/courses/:id/progress` - Обновление прогресса
- `GET /api/courses/progress/user` - Прогресс пользователя

## 🚀 Развертывание

### Production сборка

```bash
# Сборка фронтенда
cd frontend
npm run build

# Сборка бекенда
cd ../backend
npm run build

# Запуск в production
cd backend
npm start
```

### Переменные окружения для production

```env
DATABASE_URL="postgresql://username:password@localhost:5432/entechsite"
JWT_SECRET="your-super-secret-jwt-key-here"
PORT=3001
NODE_ENV="production"
```

## 🤝 Разработка

### Добавление новых функций

1. Обновите схему базы данных в `backend/prisma/schema.prisma`
2. Создайте миграцию: `npm run db:migrate`
3. Добавьте API маршруты в `backend/src/routes/`
4. Создайте React компоненты в `frontend/src/`
5. Обновите типы в `frontend/src/types/`

### Структура базы данных

- **users** - Пользователи системы
- **employees** - Сотрудники компании
- **courses** - Образовательные курсы
- **course_progress** - Прогресс обучения

## 📞 Поддержка

При возникновении проблем:
1. Проверьте логи в консоли
2. Убедитесь, что все зависимости установлены
3. Проверьте настройки базы данных
4. Убедитесь, что порты 3001 и 5173 свободны

## 📄 Лицензия

Этот проект создан для внутреннего использования компании EnTech.
