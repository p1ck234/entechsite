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

// Проверяем DATABASE_URL
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ DATABASE_URL не настроен!');
  console.error('📝 В Railway добавьте переменную DATABASE_URL со значением ${{Postgres.DATABASE_URL}}');
  console.error('   (замените "Postgres" на имя вашего PostgreSQL сервиса)');
  process.exit(1);
}

const app = express();
const pool = new Pool({
  connectionString: databaseUrl,
});
const PORT = parseInt(process.env.PORT || '3001', 10);

// Middleware
app.use(helmet());
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? [
      'https://entech.p1ck23.ru', 
      'http://entech.p1ck23.ru',
      'https://entechsite-production.up.railway.app',
      process.env.FRONTEND_URL,
      'https://web.telegram.org',
      'https://webk.telegram.org',
      'https://webz.telegram.org'
    ].filter((origin): origin is string => Boolean(origin)) // Убираем undefined значения с правильной типизацией
  : [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://entech.p1ck23.ru',
      'https://entechsite-production.up.railway.app',
      'https://entechsite-backend-production.up.railway.app',
      'https://web.telegram.org',
      'https://webk.telegram.org',
      'https://webz.telegram.org'
    ];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
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

// Initialize database and start server
async function startServer() {
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
    
    // Запускаем сервер
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    }).on('error', (err: any) => {
      console.error('❌ Server error:', err);
      process.exit(1);
    });
  } catch (error: any) {
    console.error('❌ Ошибка при запуске сервера:', error.message);
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      console.error('\n❌ Не удалось подключиться к базе данных!');
      console.error('\n📝 Инструкция по настройке DATABASE_URL в Railway:');
      console.error('   1. Убедитесь, что PostgreSQL сервис добавлен в проект');
      console.error('   2. В backend сервисе перейдите в "Variables"');
      console.error('   3. Добавьте переменную DATABASE_URL');
      console.error('   4. Значение: ${{Postgres.DATABASE_URL}}');
      console.error('      (замените "Postgres" на имя вашего PostgreSQL сервиса)');
      console.error('   5. Или используйте "Raw Editor" для просмотра всех переменных');
    } else if (error.code === '28P01') {
      console.error('❌ Ошибка аутентификации. Проверьте правильность DATABASE_URL.');
    } else if (error.code === '3D000') {
      console.error('❌ База данных не существует. Проверьте имя базы данных в DATABASE_URL.');
    }
    process.exit(1);
  }
}

startServer();
