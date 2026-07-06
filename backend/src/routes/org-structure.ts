import express from 'express';
import { body, validationResult } from 'express-validator';
import { pool } from '../db/pool';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { buildOrgTree, mapOrgEmployee, wouldCreateManagerCycle } from '../utils/org-structure';

const router = express.Router();

router.get('/tree', authenticateToken, async (_req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT e.id, e.first_name, e.last_name, e.middle_name, e.position, e.department, e.photo, e.manager_id
       FROM employees e
       WHERE e.is_active = true AND e.status = 'APPROVED'
       ORDER BY e.last_name ASC, e.first_name ASC`
    );

    const employees = result.rows.map(mapOrgEmployee);
    const roots = buildOrgTree(employees);

    res.json({
      companyName: 'EnTech',
      total: employees.length,
      roots,
      employees,
    });
  } catch (error) {
    console.error('Get org tree error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.patch(
  '/employees/:id/manager',
  authenticateToken,
  requireAdmin,
  [body('managerId').optional({ nullable: true }).isInt({ min: 1 })],
  async (req: AuthRequest, res: any) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const managerId = req.body.managerId === null || req.body.managerId === undefined
        ? null
        : String(req.body.managerId);

      const existing = await pool.query('SELECT id, manager_id FROM employees WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ message: 'Сотрудник не найден' });
      }

      if (managerId) {
        const manager = await pool.query(
          `SELECT id FROM employees WHERE id = $1 AND is_active = true AND status = 'APPROVED'`,
          [managerId]
        );

        if (manager.rows.length === 0) {
          return res.status(400).json({ message: 'Руководитель не найден или неактивен' });
        }

        const hasCycle = await wouldCreateManagerCycle(pool, id, managerId);
        if (hasCycle) {
          return res.status(400).json({ message: 'Нельзя назначить руководителя: получится цикл в структуре' });
        }
      }

      await pool.query(
        `UPDATE employees
         SET manager_id = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [managerId, id]
      );

      const updated = await pool.query(
        `SELECT e.id, e.first_name, e.last_name, e.middle_name, e.position, e.department, e.photo, e.manager_id
         FROM employees e
         WHERE e.id = $1`,
        [id]
      );

      res.json({
        message: 'Руководитель обновлён',
        employee: mapOrgEmployee(updated.rows[0]),
      });
    } catch (error) {
      console.error('Update employee manager error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

export default router;
