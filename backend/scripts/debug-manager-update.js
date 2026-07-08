/**
 * Локальная проверка сохранения manager_id.
 * Запуск: cd backend && node scripts/debug-manager-update.js [employeeId] [managerId]
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');

const employeeId = process.argv[2] || '1';
const managerId = process.argv[3] || null;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('1. Проверка колонок employees...');
    const columns = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'employees'
        AND column_name IN ('manager_id', 'updated_at')
      ORDER BY column_name
    `);
    console.log('   Колонки:', columns.rows.map((row) => row.column_name).join(', ') || '(нет)');

    console.log('2. ensureEmployeesOrgSchema...');
    const { ensureEmployeesOrgSchema } = require('../dist/utils/ensure-schema');
    await ensureEmployeesOrgSchema(pool);
    console.log('   OK');

    console.log(`3. updateEmployeeManager employee=${employeeId} manager=${managerId || 'null'}...`);
    const { updateEmployeeManager } = require('../dist/utils/employee-manager');
    const result = await updateEmployeeManager(pool, String(employeeId), managerId ? String(managerId) : null);
    console.log('   OK:', result);

    const links = await pool.query(
      `SELECT COUNT(*)::int AS count FROM employees WHERE manager_id IS NOT NULL`
    );
    console.log('4. Связей manager_id в БД:', links.rows[0].count);
  } catch (error) {
    console.error('ОШИБКА:', error.message);
    if (error.code) {
      console.error('   PG code:', error.code);
    }
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
