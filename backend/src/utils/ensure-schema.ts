import { Pool } from 'pg';

let managerIdColumnEnsured = false;
let bookingResourcesSchemaEnsured = false;

export const ensureBookingResourcesSchema = async (pool: Pool): Promise<void> => {
  if (bookingResourcesSchemaEnsured) {
    return;
  }

  try {
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
      CREATE INDEX IF NOT EXISTS idx_booking_resources_type_active
        ON booking_resources(type, is_active);
    `);
    bookingResourcesSchemaEnsured = true;
  } catch (error) {
    bookingResourcesSchemaEnsured = false;
    throw error;
  }
};

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
