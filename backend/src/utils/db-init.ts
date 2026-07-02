import { Pool } from 'pg';

export async function initializeDatabase(pool: Pool) {
  try {
    console.log('🔍 Проверка базы данных...');
    
    // Проверяем, существует ли таблица users
    const checkTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (!checkTable.rows[0].exists) {
      console.log('📦 Таблицы не найдены, инициализация базы данных...');
      
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
          telegram_id BIGINT,
          photo VARCHAR(500),
          is_active BOOLEAN DEFAULT true,
          status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      // Добавляем колонку status если её нет (для существующих баз)
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

      // Добавляем колонку telegram_id если её нет (для поиска по Telegram ID)
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
          type VARCHAR(10) NOT NULL DEFAULT 'BOT' CHECK (type IN ('BOT', 'SITE')),
          username VARCHAR(100),
          url VARCHAR(500),
          description TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS booking_resources (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          type VARCHAR(10) NOT NULL CHECK (type IN ('room', 'zoom')),
          zoom_url VARCHAR(500),
          description TEXT,
          sort_order INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS bookings (
          id SERIAL PRIMARY KEY,
          resource_id INTEGER NOT NULL REFERENCES booking_resources(id) ON DELETE RESTRICT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          starts_at TIMESTAMP NOT NULL,
          ends_at TIMESTAMP NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CHECK (ends_at > starts_at)
        );
      `);

      // Создание индексов
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
      await pool.query('CREATE INDEX IF NOT EXISTS idx_bots_username ON bots(username) WHERE username IS NOT NULL;');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_booking_resources_type_active ON booking_resources(type, is_active);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_bookings_resource_time ON bookings(resource_id, starts_at, ends_at) WHERE status = \'confirmed\';');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id, starts_at DESC);');

      const zoomCount = await pool.query(
        `SELECT COUNT(*)::int AS count FROM booking_resources WHERE type = 'zoom'`
      );
      if ((zoomCount.rows[0]?.count || 0) === 0) {
        await pool.query(
          `INSERT INTO booking_resources (name, type, zoom_url, description, sort_order)
           VALUES ('Zoom 1', 'zoom', NULL, 'Основной корпоративный Zoom', 0)`
        );
      }

      console.log('✅ Таблицы созданы');
    } else {
      console.log('✅ Таблицы уже существуют');
      
      // Проверяем и добавляем недостающие колонки для существующих таблиц
      console.log('🔍 Проверка существующих колонок...');
      
      // Добавляем колонку status если её нет
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
      
      // Проверяем и исправляем колонку telegram_id
      const telegramIdCheck = await pool.query(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'employees' AND column_name = 'telegram_id'
      `);
      
      if (telegramIdCheck.rows.length === 0) {
        // Колонки нет - создаем
        await pool.query(`
          ALTER TABLE employees ADD COLUMN telegram_id BIGINT;
        `);
        await pool.query(`
          CREATE INDEX IF NOT EXISTS idx_employees_telegram_id ON employees(telegram_id) WHERE telegram_id IS NOT NULL;
        `);
        console.log('✅ Колонка telegram_id добавлена (BIGINT)');
      } else if (telegramIdCheck.rows[0].data_type === 'text' || telegramIdCheck.rows[0].data_type === 'character varying') {
        // Колонка есть, но неправильного типа - исправляем
        console.log('⚠️ Колонка telegram_id имеет неправильный тип, исправляем...');
        await pool.query(`
          ALTER TABLE employees ALTER COLUMN telegram_id TYPE BIGINT USING NULLIF(telegram_id, '')::BIGINT;
        `);
        await pool.query(`
          CREATE INDEX IF NOT EXISTS idx_employees_telegram_id ON employees(telegram_id) WHERE telegram_id IS NOT NULL;
        `);
        console.log('✅ Тип колонки telegram_id исправлен на BIGINT');
      } else {
        // Колонка существует и правильного типа
        await pool.query(`
          CREATE INDEX IF NOT EXISTS idx_employees_telegram_id ON employees(telegram_id) WHERE telegram_id IS NOT NULL;
        `);
        console.log('✅ Колонка telegram_id уже существует (BIGINT)');
      }
      
      // Проверяем существование таблицы bots
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
            type VARCHAR(10) NOT NULL DEFAULT 'BOT' CHECK (type IN ('BOT', 'SITE')),
            username VARCHAR(100),
            url VARCHAR(500),
            description TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await pool.query('CREATE INDEX IF NOT EXISTS idx_bots_active ON bots(is_active);');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_bots_username ON bots(username) WHERE username IS NOT NULL;');
        console.log('✅ Таблица bots создана');
      }

      // Обновляем структуру таблицы bots для поддержки Telegram ботов и сайтов
      await pool.query(`
        ALTER TABLE bots
          ADD COLUMN IF NOT EXISTS type VARCHAR(10) NOT NULL DEFAULT 'BOT',
          ADD COLUMN IF NOT EXISTS url VARCHAR(500);
      `);
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'bots_type_check'
          ) THEN
            ALTER TABLE bots
              ADD CONSTRAINT bots_type_check CHECK (type IN ('BOT', 'SITE'));
          END IF;
        END $$;
      `);
      await pool.query(`
        ALTER TABLE bots
          ALTER COLUMN username DROP NOT NULL;
      `);
      await pool.query(`
        DROP INDEX IF EXISTS idx_bots_username;
      `);
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_bots_username ON bots(username) WHERE username IS NOT NULL;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS booking_resources (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          type VARCHAR(10) NOT NULL CHECK (type IN ('room', 'zoom')),
          zoom_url VARCHAR(500),
          description TEXT,
          sort_order INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS bookings (
          id SERIAL PRIMARY KEY,
          resource_id INTEGER NOT NULL REFERENCES booking_resources(id) ON DELETE RESTRICT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          starts_at TIMESTAMP NOT NULL,
          ends_at TIMESTAMP NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CHECK (ends_at > starts_at)
        );
      `);

      await pool.query('CREATE INDEX IF NOT EXISTS idx_booking_resources_type_active ON booking_resources(type, is_active);');
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_bookings_resource_time ON bookings(resource_id, starts_at, ends_at) WHERE status = 'confirmed';`);
      await pool.query('CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id, starts_at DESC);');

      const zoomCount = await pool.query(
        `SELECT COUNT(*)::int AS count FROM booking_resources WHERE type = 'zoom'`
      );
      if ((zoomCount.rows[0]?.count || 0) === 0) {
        await pool.query(
          `INSERT INTO booking_resources (name, type, zoom_url, description, sort_order)
           VALUES ('Zoom 1', 'zoom', NULL, 'Основной корпоративный Zoom', 0)`
        );
      }
      
      console.log('✅ Проверка колонок завершена');
    }
    
    /*
      Автосоздание первого администратора отключено по запросу.
      Если потребуется вернуть поведение, раскомментируйте блок ниже
      и/или перенесите параметры администратора в переменные окружения.
    */
    // console.log('🔍 Проверка наличия администратора...');
    //
    // const ADMIN_TELEGRAM_ID = 358932815;
    // const ADMIN_TELEGRAM_USERNAME = 'p1ck23';
    // const ADMIN_EMAIL = `${ADMIN_TELEGRAM_USERNAME}@telegram.local`;
    // const ADMIN_FIRST_NAME = 'Даня';
    // const ADMIN_LAST_NAME = 'p1ck23';
    // const ADMIN_POSITION = 'Администратор';
    // const ADMIN_DEPARTMENT = 'IT-Отдел';
    // const ADMIN_PHONE = '+7 (967) 807-97-38';
    //
    // const existingAdmin = await pool.query(
    //   'SELECT * FROM employees WHERE telegram_id = $1 OR (telegram = $2 OR telegram = $3)',
    //   [ADMIN_TELEGRAM_ID, ADMIN_TELEGRAM_USERNAME, `@${ADMIN_TELEGRAM_USERNAME}`]
    // );
    //
    // if (existingAdmin.rows.length === 0) {
    //   const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [ADMIN_EMAIL]);
    //   if (existingUser.rows.length === 0) {
    //     const randomPassword = Math.random().toString(36).slice(-12);
    //     const hashedPassword = await bcrypt.hash(randomPassword, 12);
    //
    //     await pool.query(
    //       'INSERT INTO users (email, password, role) VALUES ($1, $2, $3)',
    //       [ADMIN_EMAIL, hashedPassword, 'ADMIN']
    //     );
    //   } else {
    //     await pool.query('UPDATE users SET role = $1 WHERE email = $2', ['ADMIN', ADMIN_EMAIL]);
    //   }
    //
    //   await pool.query(
    //     `INSERT INTO employees (
    //       first_name, last_name, position, department, email, phone,
    //       telegram, telegram_id, is_active, status
    //     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    //     [
    //       ADMIN_FIRST_NAME,
    //       ADMIN_LAST_NAME,
    //       ADMIN_POSITION,
    //       ADMIN_DEPARTMENT,
    //       ADMIN_EMAIL,
    //       ADMIN_PHONE,
    //       ADMIN_TELEGRAM_USERNAME,
    //       ADMIN_TELEGRAM_ID,
    //       true,
    //       'APPROVED'
    //     ]
    //   );
    // } else {
    //   const admin = existingAdmin.rows[0];
    //   if (!admin.telegram_id || admin.telegram_id !== ADMIN_TELEGRAM_ID) {
    //     await pool.query(
    //       'UPDATE employees SET telegram_id = $1, telegram = $2, is_active = true, status = $3 WHERE id = $4',
    //       [ADMIN_TELEGRAM_ID, ADMIN_TELEGRAM_USERNAME, 'APPROVED', admin.id]
    //     );
    //   }
    //
    //   const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [admin.email]);
    //   if (userCheck.rows.length > 0 && userCheck.rows[0].role !== 'ADMIN') {
    //     await pool.query('UPDATE users SET role = $1 WHERE email = $2', ['ADMIN', admin.email]);
    //   } else if (userCheck.rows.length === 0) {
    //     const randomPassword = Math.random().toString(36).slice(-12);
    //     const hashedPassword = await bcrypt.hash(randomPassword, 12);
    //     await pool.query(
    //       'INSERT INTO users (email, password, role) VALUES ($1, $2, $3)',
    //       [admin.email, hashedPassword, 'ADMIN']
    //     );
    //   }
    // }
    
    console.log('✅ База данных готова к работе');
  } catch (error) {
    console.error('❌ Ошибка при инициализации базы данных:', error);
    throw error;
  }
}

