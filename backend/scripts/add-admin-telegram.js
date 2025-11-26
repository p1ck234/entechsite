const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://p1ck23@localhost:5432/entechsite',
});

async function addAdminTelegram() {
  try {
    console.log('🔗 Подключение к базе данных...');
    
    const telegramUsername = '@pdmin1ck';
    const email = 'admin@entech.com';
    const password = 'admin123'; // Временный пароль (не используется для Telegram авторизации)
    const firstName = 'Администратор';
    const lastName = 'Системы';
    const position = 'Системный администратор';
    const department = 'IT-Отдел';
    const phone = '+7 (000) 000-00-00';

    // Проверяем, существует ли уже сотрудник
    const existingEmployee = await pool.query(
      'SELECT * FROM employees WHERE email = $1 OR telegram = $1 OR telegram = $2',
      [email, telegramUsername]
    );

    if (existingEmployee.rows.length > 0) {
      console.log('⚠️  Сотрудник уже существует, обновляем...');
      const employee = existingEmployee.rows[0];
      
      // Обновляем telegram поле
      await pool.query(
        'UPDATE employees SET telegram = $1 WHERE id = $2',
        [telegramUsername, employee.id]
      );
      console.log('✅ Telegram username обновлен для сотрудника');
    } else {
      // Создаем нового сотрудника
      console.log('👤 Создание сотрудника-администратора...');
      const employeeResult = await pool.query(
        `INSERT INTO employees (first_name, last_name, position, department, email, phone, telegram, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [firstName, lastName, position, department, email, phone, telegramUsername, true]
      );
      console.log('✅ Сотрудник создан:', employeeResult.rows[0].email);
    }

    // Проверяем, существует ли пользователь
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (existingUser.rows.length > 0) {
      console.log('⚠️  Пользователь уже существует, обновляем роль на ADMIN...');
      await pool.query('UPDATE users SET role = $1 WHERE email = $2', ['ADMIN', email]);
      console.log('✅ Роль обновлена на ADMIN');
    } else {
      // Создаем пользователя-администратора
      console.log('👤 Создание пользователя-администратора...');
      const hashedPassword = await bcrypt.hash(password, 12);
      
      const userResult = await pool.query(
        'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING *',
        [email, hashedPassword, 'ADMIN']
      );
      console.log('✅ Администратор создан:', userResult.rows[0].email);
    }

    console.log('\n📋 Данные для входа:');
    console.log('   Telegram username:', telegramUsername);
    console.log('   Email:', email);
    console.log('   Role: ADMIN');
    console.log('\n✅ Администратор готов к использованию через Telegram!');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка:', error);
    await pool.end();
    process.exit(1);
  }
}

addAdminTelegram();

