import { Pool } from 'pg';

let managerIdColumnEnsured = false;

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
