"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDatabase = initializeDatabase;
async function initializeDatabase(pool) {
    try {
        console.log('🔍 Проверка базы данных...');
        const checkTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
        if (!checkTable.rows[0].exists) {
            console.log('📦 Таблицы не найдены, инициализация базы данных...');
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
          status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
            await pool.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'employees' AND column_name = 'status'
          ) THEN
            ALTER TABLE employees ADD COLUMN status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'));
            -- Существующие сотрудники считаем одобренными
            UPDATE employees SET status = 'APPROVED' WHERE status IS NULL;
          END IF;
        END $$;
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
        CREATE TABLE IF NOT EXISTS lessons (
          id SERIAL PRIMARY KEY,
          course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          google_drive_url VARCHAR(500),
          duration INTEGER,
          order_index INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
            await pool.query(`
        CREATE TABLE IF NOT EXISTS lesson_progress (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
          completed BOOLEAN DEFAULT false,
          started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP,
          UNIQUE(user_id, lesson_id)
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
            await pool.query(`
        CREATE TABLE IF NOT EXISTS events (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          google_drive_url VARCHAR(500) NOT NULL,
          preview_images TEXT[],
          event_date DATE,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
            await pool.query(`
        CREATE TABLE IF NOT EXISTS calendar_events (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          event_date DATE NOT NULL,
          event_time TIME,
          location VARCHAR(255),
          is_all_day BOOLEAN DEFAULT false,
          created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
            await pool.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active);');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id);');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_lessons_order ON lessons(course_id, order_index);');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_lesson_progress_user ON lesson_progress(user_id);');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_course_progress_user ON course_progress(user_id);');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_events_active ON events(is_active);');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date DESC);');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(event_date);');
            console.log('✅ Таблицы созданы');
        }
        else {
            console.log('✅ Таблицы уже существуют');
        }
        console.log('✅ База данных готова к работе');
    }
    catch (error) {
        console.error('❌ Ошибка при инициализации базы данных:', error);
        throw error;
    }
}
//# sourceMappingURL=db-init.js.map