import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { Pool } from 'pg';

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://p1ck23@localhost:5432/entechsite',
});

// Register - ВРЕМЕННО: Разрешена регистрация первого пользователя с Telegram
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('telegramUsername').notEmpty().trim(),
  body('firstName').notEmpty().trim(),
  body('lastName').notEmpty().trim(),
  body('position').optional().isString().trim(),
  body('department').optional().isString().trim(),
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, telegramUsername, firstName, lastName, position, department } = req.body;

    // Проверяем, есть ли уже пользователи в системе
    const existingUsers = await pool.query('SELECT COUNT(*) as count FROM users');
    const userCount = parseInt(existingUsers.rows[0].count);

    // Если уже есть пользователи - запрещаем регистрацию
    if (userCount > 0) {
      return res.status(403).json({ 
        message: 'Регистрация закрыта. Обратитесь к администратору для добавления в систему.',
        hint: 'Первый пользователь уже зарегистрирован. Для добавления новых пользователей используйте админ-панель.'
      });
    }

    // Проверяем, не существует ли уже пользователь с таким email
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'Пользователь с таким email уже существует' });
    }

    // Нормализуем Telegram username (убираем @ если есть)
    const telegramNormalized = telegramUsername.startsWith('@') 
      ? telegramUsername.substring(1) 
      : telegramUsername;

    // Проверяем, не существует ли уже сотрудник с таким Telegram
    const existingEmployee = await pool.query(
      'SELECT id FROM employees WHERE telegram = $1 OR telegram = $2',
      [telegramNormalized, `@${telegramNormalized}`]
    );
    if (existingEmployee.rows.length > 0) {
      return res.status(400).json({ message: 'Сотрудник с таким Telegram username уже существует' });
    }

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 12);

    // Создаем пользователя (первый пользователь становится ADMIN)
    const userResult = await pool.query(
      'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id, email, role, created_at',
      [email, hashedPassword, 'ADMIN']
    );

    const user = userResult.rows[0];

    // Создаем сотрудника с Telegram username
    const employeeResult = await pool.query(
      `INSERT INTO employees (first_name, last_name, position, department, email, phone, telegram, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        firstName,
        lastName,
        position || 'Сотрудник',
        department || 'Общий отдел',
        email,
        '+7 (000) 000-00-00', // Временный телефон
        telegramNormalized, // Сохраняем БЕЗ @
        true
      ]
    );

    console.log('✅ Первый пользователь зарегистрирован:', {
      email: user.email,
      role: user.role,
      telegram: telegramNormalized,
      employeeId: employeeResult.rows[0].id
    });

    // Генерируем JWT токен
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-here-change-this-in-production',
      { expiresIn: '30d' }
    );

    res.status(201).json({
      message: 'Регистрация успешна! Вы стали первым администратором.',
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      employee: {
        id: employeeResult.rows[0].id,
        firstName: employeeResult.rows[0].first_name,
        lastName: employeeResult.rows[0].last_name,
        telegram: employeeResult.rows[0].telegram
      },
      token,
      instructions: {
        telegram: `Ваш Telegram username: ${telegramNormalized}`,
        login: 'Теперь вы можете войти через Telegram Mini App',
        note: 'После входа через Telegram вы сможете добавлять других пользователей через админ-панель'
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Ошибка при регистрации', error: error instanceof Error ? error.message : 'Unknown error' });
  }
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
    const telegramUsername = telegramUser.username;

    console.log('🔍 Telegram авторизация:', {
      telegramId,
      telegramUsername,
      fullUser: telegramUser
    });

    if (!telegramId) {
      return res.status(400).json({ message: 'Telegram user ID not found' });
    }

    // Ищем сотрудника по Telegram username (приоритет) или ID
    // В базе сохраняем БЕЗ собачки, но ищем и с @, и без
    const searchVariants: string[] = [];
    
    if (telegramUsername) {
      // Убираем @ если есть, чтобы нормализовать
      const usernameNormalized = telegramUsername.startsWith('@') 
        ? telegramUsername.substring(1) 
        : telegramUsername;
      
      // Добавляем варианты: без @ (приоритет - так храним в базе), с @, и оригинальный
      searchVariants.push(usernameNormalized); // pdmin1ck (приоритет)
      searchVariants.push(`@${usernameNormalized}`); // @pdmin1ck
      if (telegramUsername !== usernameNormalized && telegramUsername !== `@${usernameNormalized}`) {
        searchVariants.push(telegramUsername); // оригинальный вариант если отличается
      }
    }
    // Также ищем по ID
    searchVariants.push(`${telegramId}`); // 123456789
    
    console.log('🔍 Telegram данные:', {
      originalUsername: telegramUsername,
      normalized: telegramUsername ? (telegramUsername.startsWith('@') ? telegramUsername.substring(1) : telegramUsername) : null,
      telegramId
    });
    console.log('🔍 Варианты поиска:', searchVariants);
    
    // Строим SQL запрос с нужным количеством параметров
    // Используем правильный синтаксис для множественного поиска
    const placeholders = searchVariants.map((_, i) => `telegram = $${i + 1}`).join(' OR ');
    const sqlQuery = `SELECT * FROM employees WHERE (${placeholders}) AND is_active = true`;
    
    console.log('🔍 SQL запрос:', sqlQuery);
    console.log('🔍 Параметры поиска:', searchVariants);
    
    const employeeResult = await pool.query(sqlQuery, searchVariants);
    
    console.log('🔍 Найдено сотрудников:', employeeResult.rows.length);
    if (employeeResult.rows.length > 0) {
      console.log('✅ Найден сотрудник:', {
        id: employeeResult.rows[0].id,
        email: employeeResult.rows[0].email,
        telegram: employeeResult.rows[0].telegram
      });
    } else {
      // Показываем все сотрудники для отладки
      const allEmployees = await pool.query('SELECT id, email, telegram, is_active FROM employees LIMIT 10');
      console.log('📋 Все сотрудники в базе:', allEmployees.rows);
    }

    // Если сотрудник не найден - возвращаем ошибку
    if (employeeResult.rows.length === 0) {
      return res.status(403).json({ 
        message: 'Доступ запрещен. Обратитесь к администратору для добавления в систему.',
        telegramUsername: telegramUsername || null,
        telegramId: telegramId
      });
    }

    const employee = employeeResult.rows[0];
    const userEmail = employee.email;

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
