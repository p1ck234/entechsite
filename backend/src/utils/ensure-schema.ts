import { Pool } from 'pg';

let managerIdColumnEnsured = false;
let bookingsModuleSchemaEnsured = false;

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

export const ensureManagerIdColumn = async (pool: Pool): Promise<void> => {
  if (managerIdColumnEnsured) {
    return;
  }

  try {
    await pool.query(`
      ALTER TABLE employees
        ADD COLUMN IF NOT EXISTS manager_id INTEGER REFERENCES employees(id) ON DELETE SET NULL;
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_employees_manager_id ON employees(manager_id);
    `);
    managerIdColumnEnsured = true;
  } catch (error) {
    managerIdColumnEnsured = false;
    throw error;
  }
};
