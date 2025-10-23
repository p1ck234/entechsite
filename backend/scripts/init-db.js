const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initDatabase() {
  try {
    console.log('🔗 Подключение к базе данных...');
    
    // Создание таблиц
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'USER' CHECK (role IN ('ADMIN', 'USER')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        middle_name VARCHAR(100),
        position VARCHAR(100) NOT NULL,
        department VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20) NOT NULL,
        telegram VARCHAR(100),
        photo VARCHAR(500),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        google_drive_url VARCHAR(500) NOT NULL,
        duration INTEGER,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS course_progress (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
        completed BOOLEAN DEFAULT false,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        UNIQUE(user_id, course_id)
      );
    `);

    // Создание индексов
    await pool.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_course_progress_user ON course_progress(user_id);');

    console.log('✅ База данных успешно инициализирована!');
    
    // Создание тестового администратора
    const adminEmail = 'admin@entech.com';
    const adminPassword = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8.8.8.8'; // password: admin123
    
    const existingAdmin = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    
    if (existingAdmin.rows.length === 0) {
      await pool.query(
        'INSERT INTO users (email, password, role) VALUES ($1, $2, $3)',
        [adminEmail, adminPassword, 'ADMIN']
      );
      console.log('👤 Создан тестовый администратор: admin@entech.com / admin123');
    }

  } catch (error) {
    console.error('❌ Ошибка при инициализации базы данных:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDatabase();
