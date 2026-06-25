import pkg from 'pg';
const { Pool } = pkg;
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

// Telegram данные администратора
const ADMIN_TELEGRAM_ID = 358932815;
const ADMIN_TELEGRAM_USERNAME = 'p1ck23';
const ADMIN_FIRST_NAME = 'Даня';
const ADMIN_LAST_NAME = 'p1ck23';
const ADMIN_EMAIL = `${ADMIN_TELEGRAM_USERNAME}@telegram.local`;
const ADMIN_POSITION = 'Администратор';
const ADMIN_DEPARTMENT = 'IT-Отдел';
const ADMIN_PHONE = '+7 (967) 807-97-38';

async function addAdmin() {
  // Проверяем DATABASE_URL
  let databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl || databaseUrl.includes('{{') || databaseUrl.trim() === '') {
    // Fallback для Railway
    databaseUrl = 'postgresql://postgres:fMRvspHdgKpSjCIPQDizWQFwpYPNNtJf@postgres.railway.internal:5432/railway';
    console.log('⚠️ Используем fallback DATABASE_URL');
  }

  const pool = new Pool({
    connectionString: databaseUrl,
  });

  try {
    console.log('🔗 Подключение к базе данных...');
    await pool.query('SELECT 1');
    console.log('✅ Подключение установлено');

    // Проверяем, существует ли уже администратор с таким Telegram ID
    const existingEmployee = await pool.query(
      'SELECT * FROM employees WHERE telegram_id = $1 OR telegram = $2 OR telegram = $3',
      [ADMIN_TELEGRAM_ID, ADMIN_TELEGRAM_USERNAME, `@${ADMIN_TELEGRAM_USERNAME}`]
    );

    if (existingEmployee.rows.length > 0) {
      const emp = existingEmployee.rows[0];
      console.log('ℹ️ Сотрудник уже существует:', {
        id: emp.id,
        email: emp.email,
        telegram: emp.telegram,
        telegram_id: emp.telegram_id,
        status: emp.status
      });

      // Обновляем данные если нужно
      await pool.query(
        `UPDATE employees 
         SET telegram_id = $1, 
             telegram = $2, 
             is_active = true, 
             status = 'APPROVED',
             first_name = $3,
             last_name = $4
         WHERE id = $5`,
        [ADMIN_TELEGRAM_ID, ADMIN_TELEGRAM_USERNAME, ADMIN_FIRST_NAME, ADMIN_LAST_NAME, emp.id]
      );

      // Проверяем пользователя
      const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [emp.email]);
      
      if (existingUser.rows.length > 0) {
        // Обновляем роль на ADMIN
        await pool.query('UPDATE users SET role = $1 WHERE email = $2', ['ADMIN', emp.email]);
        console.log('✅ Пользователь обновлен, роль установлена: ADMIN');
      } else {
        // Создаем пользователя
        const randomPassword = Math.random().toString(36).slice(-12);
        const hashedPassword = await bcrypt.hash(randomPassword, 12);
        await pool.query(
          'INSERT INTO users (email, password, role) VALUES ($1, $2, $3)',
          [emp.email, hashedPassword, 'ADMIN']
        );
        console.log('✅ Пользователь создан с ролью ADMIN');
      }

      console.log('✅ Администратор обновлен!');
      return;
    }

    // Создаем нового администратора
    console.log('📝 Создание администратора...');

    // Создаем пользователя
    const randomPassword = Math.random().toString(36).slice(-12);
    const hashedPassword = await bcrypt.hash(randomPassword, 12);
    
    const userResult = await pool.query(
      'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING *',
      [ADMIN_EMAIL, hashedPassword, 'ADMIN']
    );
    console.log('✅ Пользователь создан:', userResult.rows[0].email);

    // Создаем сотрудника
    const employeeResult = await pool.query(
      `INSERT INTO employees (
        first_name, last_name, position, department, email, phone, 
        telegram, telegram_id, is_active, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        ADMIN_FIRST_NAME,
        ADMIN_LAST_NAME,
        ADMIN_POSITION,
        ADMIN_DEPARTMENT,
        ADMIN_EMAIL,
        ADMIN_PHONE,
        ADMIN_TELEGRAM_USERNAME,
        ADMIN_TELEGRAM_ID,
        true,
        'APPROVED'
      ]
    );
    console.log('✅ Сотрудник создан:', employeeResult.rows[0].id);

    console.log('\n✅ Администратор успешно создан!');
    console.log('📧 Email:', ADMIN_EMAIL);
    console.log('🆔 Telegram ID:', ADMIN_TELEGRAM_ID);
    console.log('👤 Telegram username:', ADMIN_TELEGRAM_USERNAME);
    console.log('🔑 Роль: ADMIN');

  } catch (error) {
    console.error('❌ Ошибка:', error);
    if (error.code === '42703') {
      console.error('\n❌ Колонка telegram_id не существует или имеет неправильный тип!');
      console.error('📝 Решение:');
      console.error('   1. Убедитесь, что колонка telegram_id существует в таблице employees');
      console.error('   2. Тип колонки должен быть BIGINT, а не TEXT');
      console.error('   3. Выполните SQL:');
      console.error('      ALTER TABLE employees ALTER COLUMN telegram_id TYPE BIGINT USING telegram_id::BIGINT;');
      console.error('      (если колонка была TEXT)');
    }
    throw error;
  } finally {
    await pool.end();
  }
}

addAdmin()
  .then(() => {
    console.log('\n✅ Готово!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Ошибка при выполнении скрипта:', error);
    process.exit(1);
  });

