import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { Pool } from 'pg';

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://p1ck23@localhost:5432/entechsite',
});

// Register - DISABLED: Only admins can create users now
router.post('/register', async (req: any, res: any) => {
  res.status(403).json({ message: 'Public registration is disabled. Please contact an administrator.' });
});

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-here-change-this-in-production',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Telegram login
router.post('/telegram', [
  body('initData').notEmpty()
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { initData } = req.body;

    // Парсим initData (формат: key1=value1&key2=value2&hash=...)
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');

    // Получаем данные пользователя из initData
    const userStr = params.get('user');
    if (!userStr) {
      return res.status(400).json({ message: 'User data not found in initData' });
    }

    const telegramUser = JSON.parse(decodeURIComponent(userStr));
    const telegramId = telegramUser.id;

    if (!telegramId) {
      return res.status(400).json({ message: 'Telegram user ID not found' });
    }

    // Ищем пользователя по Telegram ID или создаем email на основе Telegram username
    // Для упрощения, ищем сотрудника с telegram полем, которое содержит ID или username
    // Или ищем пользователя по email, который может быть связан с Telegram
    
    // Сначала пытаемся найти сотрудника по telegram ID или username
    const employeeResult = await pool.query(
      `SELECT * FROM employees WHERE telegram = $1 OR telegram = $2 OR telegram = $3`,
      [`${telegramId}`, `@${telegramUser.username}`, telegramUser.username]
    );

    let userEmail: string | null = null;
    
    if (employeeResult.rows.length > 0) {
      userEmail = employeeResult.rows[0].email;
    } else {
      // Если сотрудник не найден, создаем email на основе Telegram данных
      // Формат: telegram_{id}@telegram.local или используем username если есть
      userEmail = telegramUser.username 
        ? `${telegramUser.username}@telegram.local`
        : `telegram_${telegramId}@telegram.local`;
    }

    // Ищем или создаем пользователя
    let userResult = await pool.query('SELECT * FROM users WHERE email = $1', [userEmail]);

    let user;
    if (userResult.rows.length === 0) {
      // Создаем нового пользователя для Telegram
      // Генерируем случайный пароль (он не будет использоваться для Telegram авторизации)
      const randomPassword = Math.random().toString(36).slice(-12);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      
      const insertResult = await pool.query(
        'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING *',
        [userEmail, hashedPassword, 'USER']
      );
      user = insertResult.rows[0];
    } else {
      user = userResult.rows[0];
    }

    // Генерируем JWT токен
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, telegramId },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-here-change-this-in-production',
      { expiresIn: '30d' } // Дольше для Telegram авторизации
    );

    res.json({
      message: 'Telegram login successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        telegramId: telegramId,
        telegramUser: telegramUser
      },
      token
    });
  } catch (error) {
    console.error('Telegram login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-here-change-this-in-production') as any;
    const result = await pool.query(
      'SELECT id, email, role, created_at FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const user = result.rows[0];

    return res.json({ user });
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
});

export default router;
