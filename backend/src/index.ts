import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { Pool } from 'pg';

// Import routes
import authRoutes from './routes/auth';
import employeeRoutes from './routes/employees';
import courseRoutes from './routes/courses';
import lessonRoutes from './routes/lessons';
import userRoutes from './routes/users';
import eventRoutes from './routes/events';
import calendarRoutes from './routes/calendar';
import { initializeDatabase } from './utils/db-init';

dotenv.config();

// Проверяем DATABASE_URL и пытаемся собрать его из отдельных переменных PostgreSQL
let databaseUrl = process.env.DATABASE_URL;

// Если DATABASE_URL не настроен или содержит шаблон Railway, пытаемся собрать из отдельных переменных
if (!databaseUrl || databaseUrl.includes('{{') || databaseUrl.trim() === '') {
  // Проверяем переменные PostgreSQL (Railway автоматически создает их для PostgreSQL сервиса)
  const pgHost = process.env.PGHOST;
  const pgPort = process.env.PGPORT || '5432';
  const pgUser = process.env.PGUSER;
  const pgPassword = process.env.PGPASSWORD;
  const pgDatabase = process.env.PGDATABASE;
  
  // Если есть все необходимые переменные, собираем DATABASE_URL
  if (pgHost && pgUser && pgPassword && pgDatabase) {
    databaseUrl = `postgresql://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgDatabase}`;
    console.log('✅ DATABASE_URL собран из переменных PostgreSQL');
  } else {
    // Проверяем альтернативные имена переменных
    databaseUrl = process.env.POSTGRES_URL || 
                  process.env.POSTGRES_DATABASE_URL ||
                  process.env.DATABASE_CONNECTION_STRING;
  }
  
  // Пытаемся найти переменные через возможные имена сервисов Railway
  if ((!databaseUrl || databaseUrl.includes('{{') || databaseUrl.trim() === '') && !pgHost) {
    // Проверяем все переменные окружения на наличие DATABASE_URL от разных сервисов
    const possibleServiceNames = ['Postgres', 'PostgreSQL', 'Database', 'Postgresql', 'DB', 'pg'];
    const allEnvKeys = Object.keys(process.env);
    
    for (const serviceName of possibleServiceNames) {
      // Railway может создавать переменные в формате SERVICE_NAME_DATABASE_URL
      const possibleKeys = [
        `${serviceName}_DATABASE_URL`,
        `${serviceName.toUpperCase()}_DATABASE_URL`,
        `${serviceName.toLowerCase()}_DATABASE_URL`,
      ];
      
      for (const key of possibleKeys) {
        if (process.env[key] && !process.env[key].includes('{{')) {
          databaseUrl = process.env[key];
          console.log(`✅ DATABASE_URL найден в переменной: ${key}`);
          break;
        }
      }
      if (databaseUrl && !databaseUrl.includes('{{')) break;
    }
  }
  
  if (!databaseUrl || databaseUrl.includes('{{') || databaseUrl.trim() === '') {
    console.error('⚠️ DATABASE_URL не настроен!');
    console.error('\n📊 Доступные переменные PostgreSQL:');
    const pgVars = ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'];
    pgVars.forEach(key => {
      const value = process.env[key];
      console.error(`   ${key}: ${value ? '✓ установлена' : '✗ не установлена'}`);
    });
    
    console.error('\n📋 Все переменные, содержащие "DATABASE" или "POSTGRES":');
    const dbRelatedVars = Object.keys(process.env).filter(key => 
      key.toUpperCase().includes('DATABASE') || 
      key.toUpperCase().includes('POSTGRES') ||
      key.toUpperCase().includes('PG')
    );
    if (dbRelatedVars.length > 0) {
      dbRelatedVars.forEach(key => {
        const value = process.env[key];
        const masked = value && value.length > 30 
          ? `${value.substring(0, 15)}...${value.substring(value.length - 10)}`
          : (value || '<empty>');
        console.error(`   ${key}: ${masked}`);
      });
    } else {
      console.error('   (переменные не найдены)');
    }
    
    console.error('\n📝 Решение для Railway:');
    console.error('   1. Убедитесь, что PostgreSQL сервис добавлен в проект');
    console.error('   2. В backend сервисе → Variables → DATABASE_URL');
    console.error('   3. Попробуйте эти варианты (по очереди):');
    console.error('      - ${{Postgres.DATABASE_URL}}');
    console.error('      - ${{PostgreSQL.DATABASE_URL}}');
    console.error('      - ${{Database.DATABASE_URL}}');
    console.error('      - ${{Postgresql.DATABASE_URL}}');
    console.error('   4. Или используйте "Raw Editor" чтобы увидеть все доступные переменные');
    console.error('\n⚠️ Сервер запустится, но подключение к базе данных будет недоступно');
    // НЕ завершаем процесс - сервер должен запуститься для обработки CORS запросов
    databaseUrl = 'postgresql://localhost:5432/entechsite'; // Временный URL для инициализации Pool
  }
}

const app = express();
const pool = new Pool({
  connectionString: databaseUrl,
});
const PORT = parseInt(process.env.PORT || '3001', 10);

// CORS должен быть ПЕРЕД helmet, иначе helmet может блокировать заголовки
// Сначала настраиваем CORS

// Нормализуем FRONTEND_URL (убираем слэш в конце)
const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, '') || '';

const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? [
      'https://entech.p1ck23.ru', 
      'http://entech.p1ck23.ru',
      'https://entechsite-production.up.railway.app',
      'https://entechsite-frontend-production.up.railway.app',
      'https://entechsite-backend-production.up.railway.app',
      'https://oauth.telegram.org', // Для Telegram OAuth Widget
      frontendUrl, // Нормализованный URL без слэша
      'https://web.telegram.org',
      'https://webk.telegram.org',
      'https://webz.telegram.org',
      'https://telegram.org',
      'https://t.me'
    ].filter((origin): origin is string => Boolean(origin)) // Убираем undefined и пустые значения
  : [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://entech.p1ck23.ru',
      'https://entechsite-production.up.railway.app',
      'https://entechsite-frontend-production.up.railway.app',
      'https://entechsite-backend-production.up.railway.app',
      'https://web.telegram.org',
      'https://webk.telegram.org',
      'https://webz.telegram.org',
      'https://telegram.org',
      'https://t.me'
    ];

console.log('🌐 Allowed CORS origins:', allowedOrigins);

// Явная обработка OPTIONS запросов ПЕРЕД всеми другими middleware
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  console.log('🔍 OPTIONS preflight request:', {
    origin,
    path: req.path,
    method: req.method
  });
  
  if (!origin) {
    return res.sendStatus(204);
  }
  
  // Нормализуем origin
  const normalizedOrigin = origin.replace(/\/$/, '');
  
  // Проверяем, разрешен ли origin
  const isAllowed = allowedOrigins.includes(origin) || 
                   allowedOrigins.includes(normalizedOrigin) || 
                   allowedOrigins.some(allowed => {
                     const normalizedAllowed = allowed.replace(/\/$/, '');
                     return normalizedAllowed === normalizedOrigin;
                   });
  
  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.setHeader('Access-Control-Max-Age', '86400');
    console.log('✅ OPTIONS allowed for:', origin);
    return res.sendStatus(204);
  } else {
    console.warn('❌ OPTIONS blocked for:', origin);
    return res.status(403).json({ error: 'CORS not allowed' });
  }
});

// Упрощенная и надежная CORS конфигурация
// Используем только один cors middleware, но с правильной настройкой
app.use(cors({
  origin: (origin, callback) => {
    // Разрешаем запросы без origin (например, из Postman или мобильных приложений)
    if (!origin) {
      return callback(null, true);
    }
    
    // Нормализуем origin (убираем слэш в конце)
    const normalizedOrigin = origin.replace(/\/$/, '');
    
    // Проверяем, разрешен ли origin
    const isAllowed = allowedOrigins.includes(origin) || 
                     allowedOrigins.includes(normalizedOrigin) || 
                     allowedOrigins.some(allowed => {
                       const normalizedAllowed = allowed.replace(/\/$/, '');
                       return normalizedAllowed === normalizedOrigin;
                     });
    
    if (isAllowed) {
      console.log('✅ CORS allowed for:', origin);
      callback(null, true);
    } else {
      console.warn('❌ CORS blocked for:', origin);
      console.warn('   Normalized:', normalizedOrigin);
      console.warn('   Allowed origins:', allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400 // 24 часа кеширования preflight
}));

// Применяем helmet ПОСЛЕ CORS, чтобы он не блокировал заголовки
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting (disabled for development)
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // limit each IP to 100 requests per windowMs
//   message: 'Too many requests from this IP, please try again later.'
// });
// app.use(limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/calendar', calendarRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

// Запускаем сервер СРАЗУ, чтобы он мог обрабатывать запросы (включая OPTIONS)
// Подключение к базе данных будет выполнено асинхронно
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('✅ Server is ready to accept requests (database connection will be established in background)');
}).on('error', (err: any) => {
  console.error('❌ Server error:', err);
  process.exit(1);
});

// Initialize database in background
async function initializeDatabaseConnection() {
  try {
    console.log('🔗 Попытка подключения к базе данных...');
    if (databaseUrl) {
      const maskedUrl = databaseUrl.length > 30 
        ? `${databaseUrl.substring(0, 20)}...${databaseUrl.substring(databaseUrl.length - 10)}`
        : '***';
      console.log(`📊 DATABASE_URL: ${maskedUrl}`);
    }
    
    // Проверяем подключение к базе данных
    await pool.query('SELECT 1');
    console.log('✅ Подключение к базе данных установлено');
    
    // Инициализируем базу данных (создаем таблицы и админа, если нужно)
    await initializeDatabase(pool);
    console.log('✅ База данных инициализирована');
  } catch (error: any) {
    console.error('❌ Ошибка при подключении к базе данных:', error.message);
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      console.error('\n❌ Не удалось подключиться к базе данных!');
      console.error('\n📝 Инструкция по настройке DATABASE_URL в Railway:');
      console.error('   1. Убедитесь, что PostgreSQL сервис добавлен в проект');
      console.error('   2. В backend сервисе перейдите в "Variables"');
      console.error('   3. Добавьте переменную DATABASE_URL');
      console.error('   4. Значение: ${{Postgres.DATABASE_URL}}');
      console.error('      (замените "Postgres" на имя вашего PostgreSQL сервиса)');
      console.error('   5. Или используйте "Raw Editor" для просмотра всех переменных');
      console.error('\n⚠️ Сервер продолжит работу, но запросы к базе данных будут возвращать ошибки');
    } else if (error.code === '28P01') {
      console.error('❌ Ошибка аутентификации. Проверьте правильность DATABASE_URL.');
      console.error('⚠️ Сервер продолжит работу, но запросы к базе данных будут возвращать ошибки');
    } else if (error.code === '3D000') {
      console.error('❌ База данных не существует. Проверьте имя базы данных в DATABASE_URL.');
      console.error('⚠️ Сервер продолжит работу, но запросы к базе данных будут возвращать ошибки');
    }
    // НЕ завершаем процесс - сервер должен продолжать работать для обработки OPTIONS запросов
  }
}

// Инициализируем подключение к базе данных в фоне
initializeDatabaseConnection();
