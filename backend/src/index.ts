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
import botRoutes from './routes/bots';
import uploadRoutes from './routes/upload';
import { initializeDatabase } from './utils/db-init';
import path from 'path';
import fs from 'fs';
import type sharp from 'sharp';

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
    // Fallback: используем внутренний Railway URL для PostgreSQL
    const railwayInternalUrl = 'postgresql://postgres:fMRvspHdgKpSjCIPQDizWQFwpYPNNtJf@postgres.railway.internal:5432/railway';
    console.warn('⚠️ DATABASE_URL не найден в переменных окружения');
    console.warn('📦 Используем fallback Railway internal URL');
    databaseUrl = railwayInternalUrl;
    
    console.log('\n📊 Доступные переменные PostgreSQL:');
    const pgVars = ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'];
    pgVars.forEach(key => {
      const value = process.env[key];
      console.log(`   ${key}: ${value ? '✓ установлена' : '✗ не установлена'}`);
    });
    
    console.log('\n📋 Все переменные, содержащие "DATABASE" или "POSTGRES":');
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
        console.log(`   ${key}: ${masked}`);
      });
    } else {
      console.log('   (переменные не найдены)');
    }
  } else {
    console.log('✅ DATABASE_URL найден в переменных окружения');
  }
}

const app = express();

// Создаем pool - Railway всегда предоставляет DATABASE_URL
const pool = new Pool({
  connectionString: databaseUrl || 'postgresql://localhost:5432/entechsite',
});

// Railway автоматически устанавливает PORT, но если его нет, используем 3001
// В Railway PORT всегда должен быть установлен
const PORT = parseInt(process.env.PORT || '3001', 10);
console.log(`🔧 PORT from environment: ${process.env.PORT || 'NOT SET'}, using: ${PORT}`);
console.log(`🔧 All environment variables:`, Object.keys(process.env).filter(k => k.includes('PORT') || k.includes('NODE') || k.includes('RAILWAY')));

// CORS должен быть ПЕРЕД helmet, иначе helmet может блокировать заголовки
// Сначала настраиваем CORS

// Нормализуем FRONTEND_URL (убираем слэш в конце)
const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, '') || '';

console.log('🔧 FRONTEND_URL from env:', process.env.FRONTEND_URL);
console.log('🔧 Normalized frontendUrl:', frontendUrl);

// Базовый список разрешенных origins
const baseOrigins = [
  'https://entech.p1ck23.ru', 
  'http://entech.p1ck23.ru',
  'https://entechsite-production.up.railway.app',
  'https://entechsite-frontend-production.up.railway.app',
  'https://entechsite-backend-production.up.railway.app',
  'https://oauth.telegram.org', // Для Telegram OAuth Widget
  'https://web.telegram.org',
  'https://webk.telegram.org',
  'https://webz.telegram.org',
  'https://telegram.org',
  'https://t.me'
];

// Добавляем FRONTEND_URL если он указан и еще не в списке
if (frontendUrl && !baseOrigins.includes(frontendUrl)) {
  baseOrigins.push(frontendUrl);
}

const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? baseOrigins
  : [
      'http://localhost:5173',
      'http://localhost:3000',
      ...baseOrigins
    ];

// Убираем дубликаты и пустые значения
const uniqueOrigins = Array.from(new Set(allowedOrigins.filter((origin): origin is string => Boolean(origin))));

console.log('🌐 Allowed CORS origins:', uniqueOrigins);

// Явная обработка OPTIONS запросов ПЕРЕД всеми другими middleware
// Логируем ВСЕ запросы для отладки (даже в production)
app.use((req, res, next) => {
  // Логируем все входящие запросы
  console.log(`📥 ${req.method} ${req.path}`, {
    origin: req.headers.origin,
    'user-agent': req.headers['user-agent']?.substring(0, 50),
    timestamp: new Date().toISOString()
  });
  next();
});

app.options('*', (req, res) => {
  const origin = req.headers.origin;
  console.log('🔍 OPTIONS preflight request:', {
    origin,
    path: req.path,
    method: req.method,
    'access-control-request-method': req.headers['access-control-request-method'],
    'access-control-request-headers': req.headers['access-control-request-headers']
  });
  
  if (!origin) {
    console.log('⚠️ OPTIONS request without origin');
    return res.sendStatus(204);
  }
  
  // Нормализуем origin
  const normalizedOrigin = origin.replace(/\/$/, '');
  
  // Проверяем, разрешен ли origin (используем uniqueOrigins)
  const isAllowed = uniqueOrigins.includes(origin) || 
                   uniqueOrigins.includes(normalizedOrigin) || 
                   uniqueOrigins.some(allowed => {
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
    console.warn('   Normalized:', normalizedOrigin);
    console.warn('   Allowed origins:', uniqueOrigins);
    // Все равно отправляем заголовки для отладки
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    return res.status(403).json({ error: 'CORS not allowed', origin, allowedOrigins: uniqueOrigins });
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
    
    // Проверяем, разрешен ли origin (используем uniqueOrigins)
    const isAllowed = uniqueOrigins.includes(origin) || 
                     uniqueOrigins.includes(normalizedOrigin) || 
                     uniqueOrigins.some(allowed => {
                       const normalizedAllowed = allowed.replace(/\/$/, '');
                       return normalizedAllowed === normalizedOrigin;
                     });
    
    if (isAllowed) {
      console.log('✅ CORS allowed for:', origin);
      callback(null, true);
    } else {
      console.warn('❌ CORS blocked for:', origin);
      console.warn('   Normalized:', normalizedOrigin);
      console.warn('   Allowed origins:', uniqueOrigins);
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
app.use('/api/bots', botRoutes);
app.use('/api/upload', uploadRoutes);

// Статическая раздача загруженных файлов
const uploadsDir = process.env.NODE_ENV === 'production' 
  ? path.join(__dirname, '../uploads')
  : path.join(__dirname, '../../uploads');

// Создаем папку если её нет
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`📁 Создана папка для загрузок: ${uploadsDir}`);
}

type ResizeFit = 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
type SharpModule = typeof sharp;

const OPTIMIZABLE_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

let cachedSharpModule: SharpModule | null = null;
let sharpInitAttempted = false;

const getSharpModule = (): SharpModule | null => {
  if (sharpInitAttempted) {
    return cachedSharpModule;
  }

  sharpInitAttempted = true;

  try {
    cachedSharpModule = require('sharp') as SharpModule;
    console.log('✅ Модуль sharp успешно загружен');
    return cachedSharpModule;
  } catch (error) {
    cachedSharpModule = null;
    console.warn('⚠️ Модуль sharp недоступен, оптимизация изображений отключена');
    console.warn(error);
    return null;
  }
};

const parsePositiveInt = (value: unknown, max: number): number | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Math.min(parsed, max);
};

const isResizeFit = (value: unknown): value is ResizeFit => {
  return typeof value === 'string' && ['cover', 'contain', 'fill', 'inside', 'outside'].includes(value);
};

app.get('/api/uploads/:filename', async (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(uploadsDir, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'Файл не найден' });
  }

  const extension = path.extname(safeFilename).toLowerCase();
  const canOptimize = OPTIMIZABLE_IMAGE_EXTENSIONS.has(extension);

  const width = parsePositiveInt(req.query.w, 2048);
  const height = parsePositiveInt(req.query.h, 2048);
  const quality = parsePositiveInt(req.query.q, 100);
  const fit = isResizeFit(req.query.fit) ? req.query.fit : 'cover';

  const shouldOptimize = canOptimize && (
    width !== undefined ||
    height !== undefined ||
    quality !== undefined ||
    req.query.fit !== undefined
  );

  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Vary', 'Accept');
  res.setHeader(
    'Cache-Control',
    shouldOptimize
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=604800, stale-while-revalidate=86400'
  );

  if (!shouldOptimize) {
    return res.sendFile(filePath);
  }

  const sharpModule = getSharpModule();
  if (!sharpModule) {
    return res.sendFile(filePath);
  }

  try {
    const acceptHeader = typeof req.headers.accept === 'string' ? req.headers.accept : '';
    const prefersWebp = acceptHeader.includes('image/webp');
    const normalizedQuality = quality ?? 76;

    let transformer = sharpModule(filePath, { failOn: 'none' }).rotate();
    if (width !== undefined || height !== undefined) {
      transformer = transformer.resize({
        width,
        height,
        fit,
        withoutEnlargement: true
      });
    }

    let transformedBuffer: Buffer;
    let contentType: string;

    if (prefersWebp) {
      transformedBuffer = await transformer.webp({ quality: normalizedQuality }).toBuffer();
      contentType = 'image/webp';
    } else if (extension === '.png') {
      transformedBuffer = await transformer.png({ compressionLevel: 9 }).toBuffer();
      contentType = 'image/png';
    } else {
      transformedBuffer = await transformer.jpeg({ quality: normalizedQuality, mozjpeg: true }).toBuffer();
      contentType = 'image/jpeg';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', transformedBuffer.length.toString());
    return res.send(transformedBuffer);
  } catch (error) {
    console.error('⚠️ Не удалось оптимизировать изображение, отдаем оригинал:', error);
    return res.sendFile(filePath);
  }
});

app.use('/api/uploads', express.static(uploadsDir, {
  maxAge: '7d',
  etag: true,
  lastModified: true,
  setHeaders: (res) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
  }
}));

// Health check - должен быть ДО всех других маршрутов для быстрого ответа
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root health check (для Railway)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });
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
// В Railway сервер ДОЛЖЕН слушать на 0.0.0.0 и порту из переменной PORT
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Railway PORT: ${process.env.PORT || 'NOT SET'}`);
  console.log(`📊 Server listening on: 0.0.0.0:${PORT}`);
  console.log('✅ Server is ready to accept requests (database connection will be established in background)');
  
  // Проверяем, что сервер действительно слушает
  const address = server.address();
  if (address) {
    const addrStr = typeof address === 'string' ? address : `${address.address}:${address.port}`;
    console.log(`✅ Server address: ${addrStr}`);
    console.log(`✅ Server is listening and ready to accept connections`);
  }
  
  // Health check endpoint для Railway
  console.log(`✅ Health check available at: http://0.0.0.0:${PORT}/api/health`);
}).on('error', (err: any) => {
  console.error('❌ Server error:', err);
  console.error('❌ Error code:', err.code);
  console.error('❌ Error message:', err.message);
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
  }
  process.exit(1);
});

// Обработка ошибок сервера
server.on('clientError', (err: any, socket: any) => {
  console.error('❌ Client error:', err.message);
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

// Логируем, когда сервер закрывается
server.on('close', () => {
  console.log('⚠️ Server closed');
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
