import express from 'express';
import { body, validationResult } from 'express-validator';
import { pool } from '../db/pool';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { buildOrgTree, mapOrgEmployee, ORG_EMPLOYEE_SELECT } from '../utils/org-structure';
import { ensureEmployeesOrgSchema } from '../utils/ensure-schema';
import { EmployeeManagerError, updateEmployeeManager } from '../utils/employee-manager';

const router = express.Router();

const managerIdValidator = body('managerId').optional({ values: 'falsy' }).custom((value) => {
  if (value === null || value === undefined || value === '') {
    return true;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error('Некорректный руководитель');
  }

  return true;
});

const parseManagerId = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return String(value);
};

const loadOrgTree = async () => {
  await ensureEmployeesOrgSchema(pool);

  const result = await pool.query(
    `SELECT ${ORG_EMPLOYEE_SELECT}
     FROM employees e
     WHERE e.is_active = true AND e.status = 'APPROVED'
     ORDER BY e.last_name ASC, e.first_name ASC`
  );

  const employees = result.rows.map(mapOrgEmployee);
  const roots = buildOrgTree(employees);

  return {
    companyName: 'EnTech',
    total: employees.length,
    roots,
    employees,
  };
};

router.get('/tree', authenticateToken, async (_req: AuthRequest, res) => {
  try {
    res.json(await loadOrgTree());
  } catch (error) {
    console.error('Get org tree error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.patch(
  '/employees/:id/manager',
  authenticateToken,
  requireAdmin,
  [managerIdValidator],
  async (req: AuthRequest, res: any) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: errors.array()[0]?.msg || 'Ошибка валидации',
          errors: errors.array(),
        });
      }

      const { id } = req.params;
      const managerId = parseManagerId(req.body.managerId);
      const employee = await updateEmployeeManager(pool, id, managerId);

      res.json({
        message: 'Руководитель обновлён',
        employee,
      });
    } catch (error: any) {
      if (error instanceof EmployeeManagerError) {
        return res.status(error.status).json({ message: error.message });
      }

      console.error('Update employee manager error:', error);
      res.status(500).json({
        message: error?.message || 'Не удалось сохранить руководителя',
      });
    }
  }
);

router.post(
  '/roles',
  authenticateToken,
  requireAdmin,
  [
    body('position').notEmpty().trim(),
    body('department').notEmpty().trim(),
    managerIdValidator,
  ],
  async (req: AuthRequest, res: any) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: errors.array()[0]?.msg || 'Ошибка валидации',
          errors: errors.array(),
        });
      }

      await ensureEmployeesOrgSchema(pool);

      const { position, department } = req.body;
      const managerId = parseManagerId(req.body.managerId);

      if (managerId) {
        const manager = await pool.query(
          `SELECT id FROM employees WHERE id = $1 AND is_active = true AND status = 'APPROVED'`,
          [managerId]
        );
        if (manager.rows.length === 0) {
          return res.status(400).json({ message: 'Руководитель не найден или неактивен' });
        }
      }

      const placeholderEmail = `org-role-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@org-chart.local`;

      const result = await pool.query(
        `INSERT INTO employees (
           first_name, last_name, position, department, email, phone, status, is_active, manager_id, org_display_mode
         )
         VALUES ($1, $2, $3, $4, $5, $6, 'APPROVED', true, $7, 'role')
         RETURNING *`,
        ['—', '—', position, department, placeholderEmail, '—', managerId]
      );

      const created = await pool.query(
        `SELECT ${ORG_EMPLOYEE_SELECT}
         FROM employees e
         WHERE e.id = $1`,
        [result.rows[0].id]
      );

      res.status(201).json({
        message: 'Роль добавлена на схему',
        employee: mapOrgEmployee(created.rows[0]),
      });
    } catch (error) {
      console.error('Create org role error:', error);
      res.status(500).json({ message: 'Не удалось добавить роль на схему' });
    }
  }
);

router.patch(
  '/employees/:id/display-mode',
  authenticateToken,
  requireAdmin,
  [body('orgDisplayMode').isIn(['person', 'role'])],
  async (req: AuthRequest, res: any) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: errors.array()[0]?.msg || 'Ошибка валидации',
          errors: errors.array(),
        });
      }

      await ensureEmployeesOrgSchema(pool);

      const { id } = req.params;
      const { orgDisplayMode } = req.body;

      const existing = await pool.query('SELECT id FROM employees WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ message: 'Сотрудник не найден' });
      }

      await pool.query(
        `UPDATE employees
         SET org_display_mode = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [orgDisplayMode, id]
      );

      const updated = await pool.query(
        `SELECT ${ORG_EMPLOYEE_SELECT}
         FROM employees e
         WHERE e.id = $1`,
        [id]
      );

      res.json({
        message: 'Режим отображения обновлён',
        employee: mapOrgEmployee(updated.rows[0]),
      });
    } catch (error) {
      console.error('Update org display mode error:', error);
      res.status(500).json({ message: 'Не удалось обновить режим отображения' });
    }
  }
);

export default router;
