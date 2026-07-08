import express from 'express';
import { body, validationResult } from 'express-validator';
import { pool } from '../db/pool';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { buildOrgTree, mapOrgEmployee } from '../utils/org-structure';
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
    `SELECT e.id, e.first_name, e.last_name, e.middle_name, e.position, e.department, e.photo, e.manager_id
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

export default router;
