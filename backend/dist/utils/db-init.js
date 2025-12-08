"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDatabase = initializeDatabase;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
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
          telegram_id BIGINT,
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
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'employees' AND column_name = 'telegram_id'
          ) THEN
            ALTER TABLE employees ADD COLUMN telegram_id BIGINT;
            -- Создаем индекс для быстрого поиска
            CREATE INDEX IF NOT EXISTS idx_employees_telegram_id ON employees(telegram_id);
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
            await pool.query(`
        CREATE TABLE IF NOT EXISTS bots (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          username VARCHAR(100) NOT NULL UNIQUE,
          description TEXT,
          is_active BOOLEAN DEFAULT true,
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
            await pool.query('CREATE INDEX IF NOT EXISTS idx_bots_active ON bots(is_active);');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_bots_username ON bots(username);');
            console.log('✅ Таблицы созданы');
        }
        else {
            console.log('✅ Таблицы уже существуют');
            console.log('🔍 Проверка существующих колонок...');
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
            const telegramIdCheck = await pool.query(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'employees' AND column_name = 'telegram_id'
      `);
            if (telegramIdCheck.rows.length === 0) {
                await pool.query(`
          ALTER TABLE employees ADD COLUMN telegram_id BIGINT;
        `);
                await pool.query(`
          CREATE INDEX IF NOT EXISTS idx_employees_telegram_id ON employees(telegram_id) WHERE telegram_id IS NOT NULL;
        `);
                console.log('✅ Колонка telegram_id добавлена (BIGINT)');
            }
            else if (telegramIdCheck.rows[0].data_type === 'text' || telegramIdCheck.rows[0].data_type === 'character varying') {
                console.log('⚠️ Колонка telegram_id имеет неправильный тип, исправляем...');
                await pool.query(`
          ALTER TABLE employees ALTER COLUMN telegram_id TYPE BIGINT USING NULLIF(telegram_id, '')::BIGINT;
        `);
                await pool.query(`
          CREATE INDEX IF NOT EXISTS idx_employees_telegram_id ON employees(telegram_id) WHERE telegram_id IS NOT NULL;
        `);
                console.log('✅ Тип колонки telegram_id исправлен на BIGINT');
            }
            else {
                await pool.query(`
          CREATE INDEX IF NOT EXISTS idx_employees_telegram_id ON employees(telegram_id) WHERE telegram_id IS NOT NULL;
        `);
                console.log('✅ Колонка telegram_id уже существует (BIGINT)');
            }
            const botsTableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'bots'
        );
      `);
            if (!botsTableCheck.rows[0].exists) {
                console.log('📦 Создание таблицы bots...');
                await pool.query(`
          CREATE TABLE IF NOT EXISTS bots (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            username VARCHAR(100) NOT NULL UNIQUE,
            description TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
                await pool.query('CREATE INDEX IF NOT EXISTS idx_bots_active ON bots(is_active);');
                await pool.query('CREATE INDEX IF NOT EXISTS idx_bots_username ON bots(username);');
                console.log('✅ Таблица bots создана');
            }
            console.log('✅ Проверка колонок завершена');
        }
        console.log('🔍 Проверка наличия администратора...');
        const ADMIN_TELEGRAM_ID = 358932815;
        const ADMIN_TELEGRAM_USERNAME = 'p1ck23';
        const ADMIN_EMAIL = `${ADMIN_TELEGRAM_USERNAME}@telegram.local`;
        const ADMIN_FIRST_NAME = 'Даня';
        const ADMIN_LAST_NAME = 'p1ck23';
        const ADMIN_POSITION = 'Администратор';
        const ADMIN_DEPARTMENT = 'IT-Отдел';
        const ADMIN_PHONE = '+7 (967) 807-97-38';
        const existingAdmin = await pool.query('SELECT * FROM employees WHERE telegram_id = $1 OR (telegram = $2 OR telegram = $3)', [ADMIN_TELEGRAM_ID, ADMIN_TELEGRAM_USERNAME, `@${ADMIN_TELEGRAM_USERNAME}`]);
        if (existingAdmin.rows.length === 0) {
            console.log('👤 Создание первого администратора...');
            const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [ADMIN_EMAIL]);
            let userId;
            if (existingUser.rows.length === 0) {
                const randomPassword = Math.random().toString(36).slice(-12);
                const hashedPassword = await bcryptjs_1.default.hash(randomPassword, 12);
                const userResult = await pool.query('INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id', [ADMIN_EMAIL, hashedPassword, 'ADMIN']);
                userId = userResult.rows[0].id;
                console.log('✅ Пользователь-администратор создан');
            }
            else {
                await pool.query('UPDATE users SET role = $1 WHERE email = $2', ['ADMIN', ADMIN_EMAIL]);
                userId = existingUser.rows[0].id;
                console.log('✅ Роль пользователя обновлена на ADMIN');
            }
            const employeeResult = await pool.query(`INSERT INTO employees (
          first_name, last_name, position, department, email, phone, 
          telegram, telegram_id, is_active, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`, [
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
            ]);
            console.log('✅ Сотрудник-администратор создан');
            console.log(`📧 Email: ${ADMIN_EMAIL}`);
            console.log(`🆔 Telegram ID: ${ADMIN_TELEGRAM_ID}`);
            console.log(`👤 Telegram username: ${ADMIN_TELEGRAM_USERNAME}`);
        }
        else {
            const admin = existingAdmin.rows[0];
            console.log('ℹ️ Администратор уже существует');
            if (!admin.telegram_id || admin.telegram_id !== ADMIN_TELEGRAM_ID) {
                await pool.query('UPDATE employees SET telegram_id = $1, telegram = $2, is_active = true, status = $3 WHERE id = $4', [ADMIN_TELEGRAM_ID, ADMIN_TELEGRAM_USERNAME, 'APPROVED', admin.id]);
                console.log('✅ Данные администратора обновлены');
            }
            const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [admin.email]);
            if (userCheck.rows.length > 0 && userCheck.rows[0].role !== 'ADMIN') {
                await pool.query('UPDATE users SET role = $1 WHERE email = $2', ['ADMIN', admin.email]);
                console.log('✅ Роль пользователя обновлена на ADMIN');
            }
            else if (userCheck.rows.length === 0) {
                const randomPassword = Math.random().toString(36).slice(-12);
                const hashedPassword = await bcryptjs_1.default.hash(randomPassword, 12);
                await pool.query('INSERT INTO users (email, password, role) VALUES ($1, $2, $3)', [admin.email, hashedPassword, 'ADMIN']);
                console.log('✅ Пользователь-администратор создан');
            }
        }
        console.log('✅ База данных готова к работе');
    }
    catch (error) {
        console.error('❌ Ошибка при инициализации базы данных:', error);
        throw error;
    }
}
//# sourceMappingURL=db-init.js.map