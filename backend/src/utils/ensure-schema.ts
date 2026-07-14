import { Pool } from 'pg';

let managerIdColumnEnsured = false;
let employeesOrgSchemaEnsured = false;
let bookingsModuleSchemaEnsured = false;
let supportModuleSchemaEnsured = false;

export const ensureBookingsModuleSchema = async (pool: Pool): Promise<void> => {
  if (bookingsModuleSchemaEnsured) {
    return;
  }

  try {
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
      ALTER TABLE booking_resources
        ADD COLUMN IF NOT EXISTS zoom_url VARCHAR(500),
        ADD COLUMN IF NOT EXISTS description TEXT,
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS booking_tags (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        recurrence_group_id UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CHECK (ends_at > starts_at)
      );
    `);

    await pool.query(`
      ALTER TABLE bookings
        ADD COLUMN IF NOT EXISTS recurrence_group_id UUID,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS booking_resource_tags (
        resource_id INTEGER NOT NULL REFERENCES booking_resources(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES booking_tags(id) ON DELETE CASCADE,
        PRIMARY KEY (resource_id, tag_id)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS booking_item_tags (
        booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES booking_tags(id) ON DELETE CASCADE,
        PRIMARY KEY (booking_id, tag_id)
      );
    `);

    await pool.query(`
      INSERT INTO booking_tags (name)
      VALUES ('SCRUM')
      ON CONFLICT (name) DO NOTHING;
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_booking_resources_type_active
        ON booking_resources(type, is_active);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_bookings_resource_time
        ON bookings(resource_id, starts_at, ends_at)
        WHERE status = 'confirmed';
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_bookings_user
        ON bookings(user_id, starts_at DESC);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_bookings_recurrence_group
        ON bookings(recurrence_group_id)
        WHERE recurrence_group_id IS NOT NULL;
    `);

    bookingsModuleSchemaEnsured = true;
  } catch (error) {
    bookingsModuleSchemaEnsured = false;
    throw error;
  }
};

/** @deprecated используйте ensureBookingsModuleSchema */
export const ensureBookingResourcesSchema = ensureBookingsModuleSchema;

export const ensureEmployeesOrgSchema = async (pool: Pool): Promise<void> => {
  if (employeesOrgSchemaEnsured) {
    return;
  }

  try {
    await pool.query(`
      ALTER TABLE employees
        ADD COLUMN IF NOT EXISTS manager_id INTEGER REFERENCES employees(id) ON DELETE SET NULL;
    `);
    await pool.query(`
      ALTER TABLE employees
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_employees_manager_id ON employees(manager_id);
    `);
    await pool.query(`
      ALTER TABLE employees
        ADD COLUMN IF NOT EXISTS org_display_mode VARCHAR(20) DEFAULT 'person';
    `);
    employeesOrgSchemaEnsured = true;
    managerIdColumnEnsured = true;
  } catch (error) {
    employeesOrgSchemaEnsured = false;
    managerIdColumnEnsured = false;
    throw error;
  }
};

export const ensureManagerIdColumn = async (pool: Pool): Promise<void> => {
  await ensureEmployeesOrgSchema(pool);
};

let supportModuleSchemaPromise: Promise<void> | null = null;

const ensureSupportSchemaOnce = async (pool: Pool): Promise<void> => {
  try {
    await pool.query(`
      ALTER TABLE employees
        ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS support_queues (
        id VARCHAR(20) PRIMARY KEY CHECK (id IN ('public', 'shadow')),
        name VARCHAR(100) NOT NULL,
        bot_token_env VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      INSERT INTO support_queues (id, name, bot_token_env)
      VALUES
        ('public', 'Техподдержка', 'BOT_TOKEN'),
        ('shadow', 'Служебная очередь', 'SUPPORT_BOT_SHADOW_TOKEN')
      ON CONFLICT (id) DO NOTHING;
    `);

    await pool.query(`
      UPDATE support_queues
      SET bot_token_env = 'BOT_TOKEN'
      WHERE id = 'public'
        AND (bot_token_env IS NULL OR bot_token_env = 'SUPPORT_BOT_PUBLIC_TOKEN');
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS support_agents (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS support_shadow_operators (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const shadowEmail = (process.env.SUPPORT_SHADOW_OPERATOR_EMAIL || '').trim().toLowerCase();
    if (shadowEmail) {
      await pool.query(
        `INSERT INTO support_shadow_operators (email, is_active)
         VALUES ($1, true)
         ON CONFLICT (email) DO UPDATE SET is_active = true`,
        [shadowEmail]
      );
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id SERIAL PRIMARY KEY,
        queue VARCHAR(20) NOT NULL REFERENCES support_queues(id),
        requester_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        requester_name VARCHAR(255) NOT NULL,
        requester_email VARCHAR(255),
        subject VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        category VARCHAR(100) DEFAULT 'other',
        priority VARCHAR(5) NOT NULL DEFAULT 'P3' CHECK (priority IN ('P1', 'P2', 'P3')),
        status VARCHAR(20) NOT NULL DEFAULT 'new'
          CHECK (status IN ('new', 'acknowledged', 'in_progress', 'waiting', 'done')),
        assignee_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        telegram_chat_id BIGINT,
        attachment_url VARCHAR(500),
        resolution_note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        acknowledged_at TIMESTAMP,
        acknowledged_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        started_at TIMESTAMP,
        resolved_at TIMESTAMP,
        resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        response_due_at TIMESTAMP,
        resolve_due_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS support_ticket_events (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
        actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        event_type VARCHAR(50) NOT NULL,
        from_status VARCHAR(20),
        to_status VARCHAR(20),
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS support_ticket_replies (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
        author_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        author_name VARCHAR(255) NOT NULL,
        is_agent BOOLEAN DEFAULT false,
        body TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_support_ticket_replies_ticket
        ON support_ticket_replies(ticket_id, created_at);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_support_tickets_queue_status
        ON support_tickets(queue, status, created_at DESC);
    `);
    await pool.query(`
      ALTER TABLE support_tickets
        ADD COLUMN IF NOT EXISTS todoist_task_id VARCHAR(64);
    `);

    // CHECK со waiting — мягко, сбой миграции не роняет весь ensure/старт
    try {
      await pool.query(`
        DO $$
        DECLARE
          def text;
        BEGIN
          SELECT pg_get_constraintdef(c.oid) INTO def
          FROM pg_constraint c
          JOIN pg_class t ON c.conrelid = t.oid
          JOIN pg_namespace n ON t.relnamespace = n.oid
          WHERE t.relname = 'support_tickets'
            AND n.nspname = 'public'
            AND c.contype = 'c'
            AND c.conname = 'support_tickets_status_check';

          IF def IS NULL THEN
            ALTER TABLE support_tickets
              ADD CONSTRAINT support_tickets_status_check
              CHECK (status IN ('new', 'acknowledged', 'in_progress', 'waiting', 'done'));
          ELSIF position('waiting' in def) = 0 THEN
            ALTER TABLE support_tickets DROP CONSTRAINT support_tickets_status_check;
            ALTER TABLE support_tickets
              ADD CONSTRAINT support_tickets_status_check
              CHECK (status IN ('new', 'acknowledged', 'in_progress', 'waiting', 'done'));
          END IF;
        EXCEPTION
          WHEN duplicate_object THEN NULL;
          WHEN undefined_table THEN NULL;
          WHEN undefined_object THEN NULL;
        END $$;
      `);
    } catch (migrationError: any) {
      console.warn(
        'support_tickets status CHECK migration skipped:',
        migrationError?.message || migrationError
      );
    }

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_support_tickets_requester
        ON support_tickets(requester_user_id, created_at DESC);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_support_tickets_todoist
        ON support_tickets(todoist_task_id)
        WHERE todoist_task_id IS NOT NULL;
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_support_ticket_events_ticket
        ON support_ticket_events(ticket_id, created_at);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_employees_is_hidden
        ON employees(is_hidden)
        WHERE is_hidden = true;
    `);

    supportModuleSchemaEnsured = true;
  } catch (error) {
    supportModuleSchemaEnsured = false;
    throw error;
  }
};

/** Без гонок: одновременные вызовы ждут одну и ту же инициализацию */
export const ensureSupportSchema = async (pool: Pool): Promise<void> => {
  if (supportModuleSchemaEnsured) {
    return;
  }
  if (!supportModuleSchemaPromise) {
    supportModuleSchemaPromise = ensureSupportSchemaOnce(pool).catch((error) => {
      supportModuleSchemaPromise = null;
      throw error;
    });
  }
  return supportModuleSchemaPromise;
};
