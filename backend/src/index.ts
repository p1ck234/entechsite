import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { Readable } from 'stream';
import { getDatabaseUrl, pool } from './db/pool';

// Import routes
import authRoutes from './routes/auth';
import employeeRoutes from './routes/employees';
import orgStructureRoutes from './routes/org-structure';
import courseRoutes from './routes/courses';
import lessonRoutes from './routes/lessons';
import userRoutes from './routes/users';
import eventRoutes from './routes/events';
import calendarRoutes from './routes/calendar';
import botRoutes from './routes/bots';
import uploadRoutes from './routes/upload';
import driveRoutes from './routes/drive';
import bookingResourcesRoutes from './routes/booking-resources';
import bookingTagsRoutes from './routes/booking-tags';
import bookingsRoutes from './routes/bookings';
import { initializeDatabase } from './utils/db-init';
import { ensureUploadsDir, logUploadsStorageStatus, resolveUploadedFilePath } from './utils/uploads';
import path from 'path';
import type sharp from 'sharp';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3001', 10);
const app = express();
const isProduction = process.env.NODE_ENV === 'production';

const API_FEATURES = [
  'employees-manager-patch',
  'org-structure-tree',
  'bookings-module',
];

const healthPayload = () => ({
  status: 'OK',
  timestamp: new Date().toISOString(),
  port: PORT,
  environment: process.env.NODE_ENV || 'development',
  features: API_FEATURES,
  gitCommit: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT || null,
});

// Railway health check — без middleware, чтобы отвечать сразу после listen()
app.get('/', (_req, res) => {
  res.json(healthPayload());
});

app.get('/health', (_req, res) => {
  res.json(healthPayload());
});

app.get('/api/health', (_req, res) => {
  res.json(healthPayload());
});

// Railway автоматически устанавливает PORT, но если его нет, используем 3001
// В Railway PORT всегда должен быть установлен
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

// Логируем входящие запросы (в production пропускаем шумные static/health)
app.use((req, res, next) => {
  const skipLogging =
    isProduction &&
    (req.path === '/' ||
      req.path === '/health' ||
      req.path === '/api/health' ||
      req.path.startsWith('/api/uploads/'));

  if (!skipLogging) {
    console.log(`📥 ${req.method} ${req.path}`, {
      origin: req.headers.origin,
      'user-agent': req.headers['user-agent']?.substring(0, 50),
      timestamp: new Date().toISOString(),
    });
  }
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
app.use('/api/org-structure', orgStructureRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/bots', botRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/drive', driveRoutes);
app.use('/api/booking-resources', bookingResourcesRoutes);
app.use('/api/booking-tags', bookingTagsRoutes);
app.use('/api/bookings', bookingsRoutes);

const uploadsDir = ensureUploadsDir();
logUploadsStorageStatus();

type ResizeFit = 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
type SharpModule = typeof sharp;

const OPTIMIZABLE_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MEDIA_PROXY_ALLOWED_HOSTS = new Set([
  'drive.google.com',
  'docs.google.com',
  'lh3.google.com',
  'lh3.googleusercontent.com',
  'drive.usercontent.google.com',
]);

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

const resolveMediaProxyUrl = (rawUrl: string): URL | null => {
  try {
    const parsedUrl = new URL(rawUrl);

    if (parsedUrl.protocol !== 'https:') {
      return null;
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    const isAllowedHost = MEDIA_PROXY_ALLOWED_HOSTS.has(hostname) || hostname.endsWith('.googleusercontent.com');

    if (!isAllowedHost) {
      return null;
    }

    return parsedUrl;
  } catch {
    return null;
  }
};

app.get('/api/media/proxy', async (req, res) => {
  const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
  if (!rawUrl) {
    res.status(400).json({ message: 'Параметр url обязателен' });
    return;
  }

  const targetUrl = resolveMediaProxyUrl(rawUrl);
  if (!targetUrl) {
    res.status(403).json({ message: 'URL недоступен для проксирования' });
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const upstreamResponse = await fetch(targetUrl.toString(), {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
        'User-Agent': 'EnTechSite-MediaProxy/1.0',
      }
    });

    if (!upstreamResponse.ok || !upstreamResponse.body) {
      res.status(502).json({
        message: 'Не удалось получить изображение из внешнего источника',
        status: upstreamResponse.status
      });
      return;
    }

    const contentType = (upstreamResponse.headers.get('content-type') || '').toLowerCase();
    if (!contentType.startsWith('image/')) {
      res.status(415).json({ message: 'Внешний URL не является изображением' });
      return;
    }

    const contentLength = upstreamResponse.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    res.setHeader('Vary', 'Accept');

    const upstreamStream = Readable.fromWeb(upstreamResponse.body as any);
    upstreamStream.on('error', (streamError) => {
      console.error('Media proxy stream error:', streamError);
      if (!res.headersSent) {
        res.status(502).json({ message: 'Ошибка потока изображения' });
      } else {
        res.destroy(streamError as Error);
      }
    });

    upstreamStream.pipe(res);
    return;
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      res.status(504).json({ message: 'Таймаут при загрузке изображения' });
      return;
    }

    console.error('Media proxy error:', error);
    res.status(502).json({ message: 'Ошибка при проксировании изображения' });
    return;
  } finally {
    clearTimeout(timeoutId);
  }
});

app.get('/api/uploads/:filename', async (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = resolveUploadedFilePath(safeFilename);

  if (!filePath) {
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

process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('uncaughtException:', error);
  process.exit(1);
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

const shutdown = (signal: string) => {
  console.log(`${signal} received, shutting down gracefully...`);
  server.close(() => {
    void pool.end().finally(() => process.exit(0));
  });

  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 15_000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Initialize database in background
async function initializeDatabaseConnection() {
  try {
    console.log('🔗 Попытка подключения к базе данных...');
    const databaseUrl = getDatabaseUrl();
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
