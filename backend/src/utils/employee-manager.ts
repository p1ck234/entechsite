import { Pool } from 'pg';
import { ensureEmployeesOrgSchema } from './ensure-schema';
import { mapOrgEmployee, wouldCreateManagerCycle } from './org-structure';

export class EmployeeManagerError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const updateEmployeeManager = async (
  pool: Pool,
  employeeId: string,
  managerId: string | null
) => {
  await ensureEmployeesOrgSchema(pool);

  const existing = await pool.query('SELECT id FROM employees WHERE id = $1', [employeeId]);
  if (existing.rows.length === 0) {
    throw new EmployeeManagerError(404, 'Сотрудник не найден');
  }

  if (managerId) {
    const manager = await pool.query(
      `SELECT id FROM employees WHERE id = $1 AND is_active = true AND status = 'APPROVED'`,
      [managerId]
    );

    if (manager.rows.length === 0) {
      throw new EmployeeManagerError(400, 'Руководитель не найден или неактивен');
    }

    const hasCycle = await wouldCreateManagerCycle(pool, employeeId, managerId);
    if (hasCycle) {
      throw new EmployeeManagerError(400, 'Нельзя назначить руководителя: получится цикл в структуре');
    }
  }

  try {
    await pool.query(
      `UPDATE employees
       SET manager_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [managerId, employeeId]
    );
  } catch (error: any) {
    if (error?.code === '42703') {
      await pool.query(`UPDATE employees SET manager_id = $1 WHERE id = $2`, [managerId, employeeId]);
    } else {
      throw error;
    }
  }

  const updated = await pool.query(
    `SELECT e.id, e.first_name, e.last_name, e.middle_name, e.position, e.department, e.photo, e.manager_id
     FROM employees e
     WHERE e.id = $1`,
    [employeeId]
  );

  return mapOrgEmployee(updated.rows[0]);
};
