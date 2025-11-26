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

dotenv.config();

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://p1ck23@localhost:5432/entechsite',
});
const PORT = process.env.PORT || 3001;

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`📊 Database URL: ${process.env.DATABASE_URL ? 'Configured' : 'NOT CONFIGURED'}`);
}).on('error', (err: any) => {
  console.error('❌ Server error:', err);
  process.exit(1);
});
