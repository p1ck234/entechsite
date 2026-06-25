import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { Pool } from 'pg';

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://p1ck23@localhost:5432/entechsite',
});

const normalizeTelegramUsername = (username?: string | null): string | null => {
  if (!username) {
    return null;
  }

  const normalized = username.trim().replace(/^@+/, '').toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

const pickBestEmployeeMatch = (rows: any[], telegramId: number, normalizedUsername: string | null) => {
  if (!rows.length) {
    return null;
  }

  const matchedById = rows.find((row) => Number(row.telegram_id) === Number(telegramId));
  if (matchedById) {
    return matchedById;
  }

  if (normalizedUsername) {
    const matchedByUsername = rows.find(
      (row) => normalizeTelegramUsername(row.telegram) === normalizedUsername
    );
    if (matchedByUsername) {
      return matchedByUsername;
    }
  }

  return rows[0];
};

const syncEmployeeTelegramData = async (employee: any, telegramId: number, normalizedUsername: string | null) => {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (Number(employee.telegram_id) !== Number(telegramId)) {
    updates.push(`telegram_id = $${paramIndex++}`);
    values.push(telegramId);
  }

  const currentUsername = normalizeTelegramUsername(employee.telegram);
  if (normalizedUsername && currentUsername !== normalizedUsername) {
    updates.push(`telegram = $${paramIndex++}`);
    values.push(normalizedUsername);
  }

  if (!updates.length) {
    return;
  }

  values.push(employee.id);
  await pool.query(
    `UPDATE employees SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex}`,
    values
  );
};

// Register через Telegram - создает заявку на регистрацию
router.post('/register-telegram', [
  body('initData').notEmpty(),
  body('firstName').notEmpty().trim(),
  body('lastName').notEmpty().trim(),
  body('position').optional().isString().trim(),
  body('department').optional().isString().trim(),
  body('phone').optional().isString().trim(),
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { initData, firstName, lastName, position, department, phone } = req.body;

    // Парсим initData
    const params = new URLSearchParams(initData);
    const userStr = params.get('user');
    if (!userStr) {
      return res.status(400).json({ message: 'User data not found in initData' });
    }

    const telegramUser = JSON.parse(decodeURIComponent(userStr));
    const telegramId = telegramUser.id;
    const telegramUsername = telegramUser.username;

    if (!telegramId) {
      return res.status(400).json({ message: 'Telegram user ID not found' });
    }

    if (!telegramUsername) {
      return res.status(400).json({ message: 'Telegram username required for registration' });
    }

    // Нормализуем username
    const telegramNormalized = normalizeTelegramUsername(telegramUsername);
    if (!telegramNormalized) {
      return res.status(400).json({ message: 'Telegram username required for registration' });
    }

    // Проверяем, есть ли уже пользователи в системе
    const usersCount = await pool.query('SELECT COUNT(*) as count FROM users');
    const totalUsers = parseInt(usersCount.rows[0].count);

    // Если это первый пользователь - создаем его сразу как админа
    if (totalUsers === 0) {
      const userEmail = `${telegramNormalized}@telegram.local`;
      const randomPassword = Math.random().toString(36).slice(-12);
      const hashedPassword = await bcrypt.hash(randomPassword, 12);

      // Создаем пользователя-администратора
      const userResult = await pool.query(
        'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING *',
        [userEmail, hashedPassword, 'ADMIN']
      );

      // Создаем сотрудника с статусом APPROVED
      const employeeResult = await pool.query(
        `INSERT INTO employees (first_name, last_name, position, department, email, phone, telegram, telegram_id, is_active, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
          firstName || telegramUser.first_name || 'Пользователь',
          lastName || telegramUser.last_name || 'Telegram',
          position || 'Администратор',
          department || 'IT-Отдел',
          userEmail,
          phone || '+7 (000) 000-00-00',
          telegramNormalized,
          telegramId,
          true,
          'APPROVED'
        ]
      );

      // Генерируем токен
      const token = jwt.sign(
        { userId: userResult.rows[0].id, email: userEmail, role: 'ADMIN' },
        process.env.JWT_SECRET || 'your-super-secret-jwt-key-here-change-this-in-production',
        { expiresIn: '30d' }
      );

      return res.status(201).json({
        message: 'Регистрация успешна! Вы стали первым администратором.',
        user: {
          id: userResult.rows[0].id,
          email: userEmail,
          role: 'ADMIN'
        },
        employee: employeeResult.rows[0],
        token,
        approved: true
      });
    }

    // Проверяем, не существует ли уже заявка или сотрудник
    const existingEmployee = await pool.query(
      'SELECT id, status FROM employees WHERE telegram_id = $1 OR LOWER(REPLACE(telegram, \'@\', \'\')) = $2',
      [telegramId, telegramNormalized]
    );

    if (existingEmployee.rows.length > 0) {
      const existing = existingEmployee.rows[0];
      if (existing.status === 'APPROVED') {
        return res.status(400).json({ message: 'Вы уже зарегистрированы в системе' });
      } else if (existing.status === 'PENDING') {
        return res.status(400).json({ message: 'Ваша заявка уже отправлена и ожидает подтверждения администратора' });
      } else if (existing.status === 'REJECTED') {
        return res.status(400).json({ message: 'Ваша заявка была отклонена. Обратитесь к администратору' });
      }
    }

    // Создаем заявку на регистрацию (статус PENDING)
    const userEmail = `${telegramNormalized}@telegram.local`;
    const employeeResult = await pool.query(
      `INSERT INTO employees (first_name, last_name, position, department, email, phone, telegram, telegram_id, is_active, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        firstName || telegramUser.first_name || 'Пользователь',
        lastName || telegramUser.last_name || 'Telegram',
        position || 'Сотрудник',
        department || 'Общий отдел',
        userEmail,
        phone || '+7 (000) 000-00-00',
        telegramNormalized,
        telegramId,
        false, // Не активен до подтверждения
        'PENDING'
      ]
    );

    console.log('📝 Новая заявка на регистрацию:', {
      telegram: telegramNormalized,
      name: `${firstName} ${lastName}`,
      email: userEmail
    });

    return res.status(201).json({
      message: 'Заявка на регистрацию отправлена. Ожидайте подтверждения администратора.',
      employee: employeeResult.rows[0],
      approved: false,
      status: 'PENDING'
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    console.error('Error details:', {
      code: error.code,
      constraint: error.constraint,
      detail: error.detail,
      message: error.message,
      stack: error.stack
    });
    
    // Более детальная обработка ошибок
    if (error.code === '23505') { // Unique constraint violation
      if (error.constraint?.includes('email')) {
        return res.status(400).json({ message: 'Пользователь с таким email уже существует' });
      }
      if (error.constraint?.includes('telegram')) {
        return res.status(400).json({ message: 'Пользователь с таким Telegram username уже зарегистрирован' });
      }
      return res.status(400).json({ message: 'Пользователь с такими данными уже существует' });
    }
    
    if (error.code === '23503') { // Foreign key violation
      return res.status(400).json({ message: 'Ошибка связи данных. Проверьте введенные данные.' });
    }
    
    res.status(500).json({ 
      message: 'Ошибка при регистрации', 
      error: error instanceof Error ? error.message : 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
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

    // Нормализуем Telegram username (убираем @ и приводим к нижнему регистру)
    const telegramNormalized = normalizeTelegramUsername(telegramUsername);
    if (!telegramNormalized) {
      return res.status(400).json({ message: 'Некорректный Telegram username' });
    }

    // Проверяем, не существует ли уже сотрудник с таким Telegram
    const existingEmployee = await pool.query(
      'SELECT id FROM employees WHERE LOWER(REPLACE(telegram, \'@\', \'\')) = $1',
      [telegramNormalized]
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

    // Ищем сотрудника по telegram_id (приоритет) и username
    const telegramNormalized = normalizeTelegramUsername(telegramUsername);
    const searchConditions: string[] = [
      'telegram_id = $1',
      'telegram = $2'
    ];
    const searchParams: Array<string | number> = [telegramId, `${telegramId}`];

    if (telegramNormalized) {
      searchConditions.push(`LOWER(REPLACE(telegram, '@', '')) = $${searchParams.length + 1}`);
      searchParams.push(telegramNormalized);
    }
    
    console.log('🔍 Telegram данные:', {
      originalUsername: telegramUsername,
      normalized: telegramNormalized,
      telegramId
    });
    console.log('🔍 Условия поиска:', searchConditions);
    
    // Ищем всех сотрудников (включая неактивных), чтобы проверить статус
    const sqlQuery = `SELECT * FROM employees WHERE (${searchConditions.join(' OR ')})`;
    
    console.log('🔍 SQL запрос:', sqlQuery);
    console.log('🔍 Параметры поиска:', searchParams);
    
    const employeeResult = await pool.query(sqlQuery, searchParams);
    
    console.log('🔍 Найдено сотрудников:', employeeResult.rows.length);
    
    let employee;
    let userEmail;
    
    // Если сотрудник не найден - автоматически создаем заявку на регистрацию
    if (employeeResult.rows.length === 0) {
      console.log('📝 Пользователь не найден, создаем заявку на регистрацию...');
      
      const userEmail = telegramNormalized ? `${telegramNormalized}@telegram.local` : `telegram_${telegramId}@telegram.local`;
      
      try {
        const newEmployeeResult = await pool.query(
          `INSERT INTO employees (
            first_name, last_name, position, department, email, phone, 
            telegram, telegram_id, is_active, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
          [
            telegramUser.first_name || 'Пользователь',
            telegramUser.last_name || 'Telegram',
            'Сотрудник',
            'Общий отдел',
            userEmail,
            '+7 (000) 000-00-00',
            telegramNormalized,
            telegramId,
            false, // Не активен до одобрения
            'PENDING' // Статус ожидания
          ]
        );
        
        console.log('✅ Заявка на регистрацию создана:', newEmployeeResult.rows[0].id);
        console.log('📧 Email:', userEmail);
        console.log('🆔 Telegram ID:', telegramId);
        console.log('👤 Telegram username:', telegramNormalized);
        
        return res.status(403).json({ 
          message: 'Ваша заявка на регистрацию отправлена. Ожидайте подтверждения администратора.',
          telegramUsername: telegramUsername || null,
          telegramId: telegramId,
          needsRegistration: true,
          status: 'PENDING',
          registrationId: newEmployeeResult.rows[0].id
        });
      } catch (error: any) {
        console.error('❌ Ошибка при создании заявки:', error);
        // Если заявка уже существует (дубликат)
        if (error.code === '23505') {
          return res.status(403).json({ 
            message: 'Заявка на регистрацию уже отправлена. Ожидайте подтверждения администратора.',
            telegramUsername: telegramUsername || null,
            telegramId: telegramId,
            needsRegistration: true,
            status: 'PENDING'
          });
        }
        throw error;
      }
    }

    // Сотрудник найден - проверяем статус
    employee = pickBestEmployeeMatch(employeeResult.rows, telegramId, telegramNormalized);
    if (!employee) {
      return res.status(403).json({
        message: 'Сотрудник не найден. Отправьте заявку на регистрацию.'
      });
    }

    await syncEmployeeTelegramData(employee, telegramId, telegramNormalized);
    userEmail = employee.email;

    // Проверяем статус заявки
    if (employee.status === 'REJECTED') {
      return res.status(403).json({ 
        message: 'Ваш аккаунт был отклонен администратором. Обратитесь к администратору.',
        status: 'REJECTED',
        telegramUsername: telegramUsername || null
      });
    }

    // Если заявка на регистрацию еще не одобрена (PENDING)
    if (employee.status === 'PENDING') {
      return res.status(403).json({ 
        message: 'Ваша заявка на регистрацию ожидает подтверждения администратора.',
        telegramUsername: telegramUsername || null,
        telegramId: telegramId,
        needsRegistration: true,
        status: 'PENDING',
        registrationId: employee.id
      });
    }

    // Проверяем, что сотрудник активен
    if (!employee.is_active) {
      return res.status(403).json({ 
        message: 'Ваш аккаунт деактивирован. Обратитесь к администратору.',
        telegramUsername: telegramUsername || null
      });
    }

    console.log('✅ Найден сотрудник:', {
      id: employee.id,
      email: employee.email,
      telegram: employee.telegram,
      status: employee.status
    });

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

// Telegram OAuth callback (для OAuth Widget)
router.post('/telegram-oauth', [
  body('id').isInt(),
  body('first_name').notEmpty(),
  body('auth_date').isInt(),
  body('hash').notEmpty(),
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id, first_name, last_name, username, photo_url, auth_date, hash } = req.body;

    console.log('🔍 Telegram OAuth авторизация:', {
      id,
      username,
      first_name,
      last_name
    });

    const normalizedUsername = normalizeTelegramUsername(username);

    // Ищем сотрудника по Telegram ID и нормализованному username
    const searchConditions: string[] = [];
    const searchParams: any[] = [];
    let paramIndex = 1;

    // Поиск по username (без учета регистра и символа @)
    if (normalizedUsername) {
      searchConditions.push(`LOWER(REPLACE(telegram, '@', '')) = $${paramIndex}`);
      searchParams.push(normalizedUsername);
      paramIndex++;
    }

    // Поиск по Telegram ID (число)
    searchConditions.push(`telegram_id = $${paramIndex}`);
    searchParams.push(id);
    paramIndex++;

    // Также ищем по telegram как строке (на случай если ID сохранен как строка)
    searchConditions.push(`telegram = $${paramIndex}`);
    searchParams.push(`${id}`);

    const whereClause = searchConditions.join(' OR ');
    const sqlQuery = `SELECT * FROM employees WHERE (${whereClause}) AND is_active = true AND status = 'APPROVED'`;

    console.log('🔍 SQL запрос:', sqlQuery);
    console.log('🔍 Параметры:', searchParams);

    // Сначала ищем без фильтра по статусу (чтобы найти всех, включая PENDING)
    const allEmployeesResult = await pool.query(
      `SELECT * FROM employees WHERE (${searchConditions.join(' OR ')})`,
      searchParams
    );

    if (allEmployeesResult.rows.length === 0) {
      // Пользователь не найден - создаем заявку на регистрацию
      console.log('📝 Пользователь не найден, создаем заявку на регистрацию...');
      
      const userEmail = normalizedUsername ? `${normalizedUsername}@telegram.local` : `telegram_${id}@telegram.local`;
      
      try {
        const newEmployeeResult = await pool.query(
          `INSERT INTO employees (
            first_name, last_name, position, department, email, phone, 
            telegram, telegram_id, is_active, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
          [
            first_name || 'Пользователь',
            last_name || 'Telegram',
            'Сотрудник',
            'Общий отдел',
            userEmail,
            '+7 (000) 000-00-00',
            normalizedUsername,
            id,
            false, // Не активен до одобрения
            'PENDING' // Статус ожидания
          ]
        );
        
        console.log('✅ Заявка на регистрацию создана:', newEmployeeResult.rows[0].id);
        console.log('📧 Email:', userEmail);
        console.log('🆔 Telegram ID:', id);
        console.log('👤 Telegram username:', normalizedUsername);
        
        return res.status(403).json({ 
          message: 'Ваша заявка на регистрацию отправлена. Ожидайте подтверждения администратора.',
          telegramUsername: username || null,
          telegramId: id,
          needsRegistration: true,
          status: 'PENDING',
          registrationId: newEmployeeResult.rows[0].id
        });
      } catch (error: any) {
        console.error('❌ Ошибка при создании заявки:', error);
        // Если заявка уже существует (дубликат)
        if (error.code === '23505') {
          return res.status(403).json({ 
            message: 'Заявка на регистрацию уже отправлена. Ожидайте подтверждения администратора.',
            telegramUsername: username || null,
            telegramId: id,
            needsRegistration: true,
            status: 'PENDING'
          });
        }
        throw error;
      }
    }

    // Если найден сотрудник со статусом PENDING
    const pendingEmployee = allEmployeesResult.rows.find((emp: any) => emp.status === 'PENDING');
    if (pendingEmployee) {
      return res.status(403).json({ 
        message: 'Ваша заявка на регистрацию ожидает подтверждения администратора.',
        telegramUsername: username || null,
        telegramId: id,
        needsRegistration: true,
        status: 'PENDING',
        registrationId: pendingEmployee.id
      });
    }

    // Если найден сотрудник со статусом REJECTED
    const rejectedEmployee = allEmployeesResult.rows.find((emp: any) => emp.status === 'REJECTED');
    if (rejectedEmployee) {
      return res.status(403).json({ 
        message: 'Ваш аккаунт был отклонен администратором. Обратитесь к администратору.',
        telegramUsername: username || null,
        telegramId: id,
        status: 'REJECTED'
      });
    }

    // Теперь проверяем только одобренных и активных
    const employeeResult = await pool.query(sqlQuery, searchParams);

    const employee = pickBestEmployeeMatch(employeeResult.rows, id, normalizedUsername);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    await syncEmployeeTelegramData(employee, id, normalizedUsername);
    const userEmail = employee.email;

    // Проверяем статус
    if (employee.status === 'REJECTED') {
      return res.status(403).json({ 
        message: 'Ваш аккаунт был отклонен администратором. Обратитесь к администратору.',
        status: 'REJECTED',
        telegramUsername: username || null
      });
    }

    if (!employee.is_active && employee.status !== 'PENDING') {
      return res.status(403).json({ 
        message: 'Ваш аккаунт деактивирован. Обратитесь к администратору.',
        telegramUsername: username || null
      });
    }

    console.log('✅ Найден сотрудник:', {
      id: employee.id,
      email: employee.email,
      telegram: employee.telegram,
      status: employee.status
    });

    console.log('✅ Telegram данные сотрудника синхронизированы:', {
      employeeId: employee.id,
      telegramId: id,
      telegramUsername: normalizedUsername
    });

    // Ищем или создаем пользователя
    let userResult = await pool.query('SELECT * FROM users WHERE email = $1', [userEmail]);

    let user;
    if (userResult.rows.length === 0) {
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
      { userId: user.id, email: user.email, role: user.role, telegramId: id },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-here-change-this-in-production',
      { expiresIn: '30d' }
    );

    res.json({
      message: 'Telegram OAuth login successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        telegramId: id,
        telegramUser: {
          id,
          first_name,
          last_name,
          username,
          photo_url
        }
      },
      token
    });
  } catch (error) {
    console.error('Telegram OAuth error:', error);
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
