const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Use correct connection string (override .env if needed)
const connectionString = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('username:password')
  ? process.env.DATABASE_URL
  : 'postgresql://p1ck23@localhost:5432/entechsite';

const pool = new Pool({
  connectionString,
});

async function resetDatabase() {
  try {
    console.log('🗑️  Очистка базы данных...');
    
    // Delete all data
    await pool.query('DELETE FROM lesson_progress');
    await pool.query('DELETE FROM course_progress');
    await pool.query('DELETE FROM lessons');
    await pool.query('DELETE FROM courses');
    await pool.query('DELETE FROM employees');
    await pool.query('DELETE FROM users');
    
    console.log('✅ База данных очищена');
    
    // Create admin user
    console.log('👤 Создание администратора...');
    
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    const userResult = await pool.query(
      'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id, email, role',
      ['admin@entech.com', hashedPassword, 'ADMIN']
    );
    
    const adminUser = userResult.rows[0];
    console.log('✅ Администратор создан:', adminUser.email);
    
    // Create employee record for admin with Telegram
    // Сохраняем БЕЗ собачки для единообразия
    const adminTelegram = '@pdmin1ck';
    const telegramWithoutAt = adminTelegram.startsWith('@') ? adminTelegram.substring(1) : adminTelegram;
    await pool.query(
      `INSERT INTO employees (first_name, last_name, position, department, email, phone, telegram, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      ['Администратор', 'Системы', 'Системный администратор', 'IT-Отдел', 'admin@entech.com', '+7 (000) 000-00-00', telegramWithoutAt, true]
    );
    
    console.log('✅ Запись сотрудника для администратора создана');
    console.log('\n📋 Данные для входа:');
    console.log('   Email: admin@entech.com');
    console.log('   Password: admin123');
    console.log('   Telegram: pdmin1ck (без @)');
    console.log('   Role: ADMIN');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка:', error);
    await pool.end();
    process.exit(1);
  }
}

resetDatabase();

