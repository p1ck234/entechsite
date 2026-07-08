import express from 'express';
import { body, validationResult, query } from 'express-validator';
import { pool } from '../db/pool';
import bcrypt from 'bcryptjs';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { wouldCreateManagerCycle, buildOrgTree, mapOrgEmployee } from '../utils/org-structure';
import { ensureEmployeesOrgSchema } from '../utils/ensure-schema';
import { EmployeeManagerError, updateEmployeeManager } from '../utils/employee-manager';

const router = express.Router();

const normalizeTelegramUsername = (username?: string | null): string | null => {
  if (!username) {
    return null;
  }

  const normalized = username.trim().replace(/^@+/, '').toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

// Get all employees
router.get('/', authenticateToken, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 500 }),
  query('search').optional().isString(),
  query('department').optional().isString(),
  query('showInactive').optional().isBoolean(),
  query('status').optional().isIn(['APPROVED', 'PENDING', 'REJECTED']) // Added status filter
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const department = req.query.department as string;
    const showInactive = req.query.showInactive === 'true' && req.user?.role === 'ADMIN';
    const statusFilter = req.query.status as string; // 'APPROVED', 'PENDING', 'REJECTED'
    const skip = (page - 1) * limit;

    // Строим WHERE clause на основе фильтра статуса
    let whereClause = '';
    const params: any[] = [];
    let paramCount = 0;

    if (statusFilter === 'PENDING') {
      // Показываем только заявки на согласовании
      paramCount++;
      whereClause = `WHERE e.status = $${paramCount}`;
      params.push('PENDING');
    } else if (statusFilter === 'REJECTED') {
      // Показываем отклоненные или неактивные
      paramCount++;
      whereClause = `WHERE (e.status = $${paramCount} OR e.is_active = false)`;
      params.push('REJECTED');
    } else {
      // По умолчанию показываем активных и одобренных
      paramCount++;
      whereClause = `WHERE e.is_active = true AND e.status = $${paramCount}`;
      params.push('APPROVED');
    }

    if (search) {
      paramCount++;
      const searchPattern = `%${search}%`;
      whereClause += ` AND (
        e.first_name ILIKE $${paramCount} OR 
        e.last_name ILIKE $${paramCount} OR 
        e.middle_name ILIKE $${paramCount} OR
        e.position ILIKE $${paramCount} OR 
        e.email ILIKE $${paramCount}
      )`;
      params.push(searchPattern);
    }

    if (department) {
      paramCount++;
      whereClause += ` AND e.department ILIKE $${paramCount}`;
      params.push(`%${department}%`);
    }

    const limitParam = paramCount + 1;
    const offsetParam = paramCount + 2;
    const queryParams = [...params, limit, skip];

    const [employeesResult, totalResult] = await Promise.all([
      pool.query(
        `SELECT e.*, u.role as user_role 
         FROM employees e 
         LEFT JOIN users u ON e.email = u.email 
         ${whereClause} 
         ORDER BY e.first_name ASC 
         LIMIT $${limitParam} OFFSET $${offsetParam}`,
        queryParams
      ),
      pool.query(`SELECT COUNT(*) FROM employees e ${whereClause}`, params)
    ]);

    const employees = employeesResult.rows;
    const total = parseInt(totalResult.rows[0].count);

    res.json({
      employees,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('Get employees error:', error);
    console.error('Error details:', error?.message || error);
    if (error?.code) {
      console.error('PostgreSQL error code:', error.code);
    }
    res.status(500).json({ 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? (error?.message || String(error)) : undefined
    });
  }
});

// Get current user's employee info
router.get('/me', authenticateToken, async (req: any, res: any) => {
  try {
    if (!req.user?.email) {
      return res.status(401).json({ message: 'User email not found' });
    }

    const result = await pool.query(
      `SELECT e.*, u.role as user_role 
       FROM employees e 
       LEFT JOIN users u ON e.email = u.email 
       WHERE e.email = $1 
       ORDER BY e.is_active DESC, e.created_at DESC 
       LIMIT 1`, 
      [req.user.email]
    );

    if (result.rows.length === 0) {
      // Return 404 but with a more descriptive message
      return res.status(404).json({ 
        message: 'Employee not found for this user',
        email: req.user.email 
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get current employee error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Org tree (дублирует /api/org-structure/tree для совместимости)
router.get('/org-tree', authenticateToken, async (_req: any, res: any) => {
  try {
    await ensureEmployeesOrgSchema(pool);

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
    console.error('Get employees org-tree error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.patch(
  '/:id/manager',
  authenticateToken,
  requireAdmin,
  [body('managerId').optional({ values: 'falsy' }).custom((value) => {
    if (value === null || value === undefined || value === '') {
      return true;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error('Некорректный руководитель');
    }

    return true;
  })],
  async (req: any, res: any) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: errors.array()[0]?.msg || 'Ошибка валидации',
          errors: errors.array(),
        });
      }

      const { id } = req.params;
      const managerId =
        req.body.managerId === null || req.body.managerId === undefined || req.body.managerId === ''
          ? null
          : String(req.body.managerId);

      const employee = await updateEmployeeManager(pool, id, managerId);

      res.json({
        message: 'Руководитель обновлён',
        employee,
      });
    } catch (error: any) {
      if (error instanceof EmployeeManagerError) {
        return res.status(error.status).json({ message: error.message });
      }

      console.error('Patch employee manager error:', error);
      res.status(500).json({
        message: error?.message || 'Не удалось сохранить руководителя',
      });
    }
  }
);

// Get employee by ID
router.get('/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT e.*, u.role as user_role 
       FROM employees e 
       LEFT JOIN users u ON e.email = u.email 
       WHERE e.id = $1`, 
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create employee (Admin only)
router.post('/', authenticateToken, [
  body('firstName').notEmpty().trim(),
  body('lastName').notEmpty().trim(),
  body('position').notEmpty().trim(),
  body('department').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('phone').notEmpty().trim(),
  body('telegram').optional().isString(),
  body('photo').optional().isString(),
  body('managerId').optional({ nullable: true }).isInt({ min: 1 })
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const {
      firstName,
      lastName,
      middleName,
      position,
      department,
      email,
      phone,
      telegram,
      photo,
      managerId
    } = req.body;
    const normalizedTelegram = normalizeTelegramUsername(telegram);

    if (managerId) {
      const manager = await pool.query(
        `SELECT id FROM employees WHERE id = $1 AND is_active = true AND status = 'APPROVED'`,
        [managerId]
      );
      if (manager.rows.length === 0) {
        return res.status(400).json({ message: 'Руководитель не найден или неактивен' });
      }
    }

    const existingEmployee = await pool.query('SELECT id FROM employees WHERE email = $1 AND is_active = true', [email]);

    if (existingEmployee.rows.length > 0) {
      return res.status(400).json({ message: 'Employee with this email already exists' });
    }

    await ensureEmployeesOrgSchema(pool);

    const result = await pool.query(
      `INSERT INTO employees (first_name, last_name, middle_name, position, department, email, phone, telegram, photo, manager_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [firstName, lastName, middleName, position, department, email, phone, normalizedTelegram, photo, managerId || null]
    );

    res.status(201).json({
      message: 'Employee created successfully',
      employee: result.rows[0]
    });
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update employee (Admin only)
router.put('/:id', authenticateToken, [
  body('firstName').optional().notEmpty().trim(),
  body('lastName').optional().notEmpty().trim(),
  body('position').optional().notEmpty().trim(),
  body('department').optional().notEmpty().trim(),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().notEmpty().trim(),
  body('telegram').optional().isString(),
  body('photo').optional().isString(),
  body('isActive').optional().isBoolean(),
  body('managerId').optional({ nullable: true }).isInt({ min: 1 }),
  body('role').optional().isIn(['ADMIN', 'USER']) // Added role field
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;
    const updateData = req.body;

    if (Object.prototype.hasOwnProperty.call(updateData, 'telegram')) {
      updateData.telegram = normalizeTelegramUsername(updateData.telegram);
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'managerId')) {
      await ensureEmployeesOrgSchema(pool);
      const managerId = updateData.managerId === null || updateData.managerId === ''
        ? null
        : String(updateData.managerId);

      updateData.managerId = managerId;

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
    }

    // Check if employee exists
    const existingEmployee = await pool.query('SELECT * FROM employees WHERE id = $1', [id]);

    if (existingEmployee.rows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // If email is being updated, check for conflicts
    if (updateData.email && updateData.email !== existingEmployee.rows[0].email) {
      const emailConflict = await pool.query('SELECT id FROM employees WHERE email = $1', [updateData.email]);

      if (emailConflict.rows.length > 0) {
        return res.status(400).json({ message: 'Employee with this email already exists' });
      }
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;
    const roleToUpdate = updateData.role; // Сохраняем роль отдельно, она не в employees

    Object.keys(updateData).forEach(key => {
      // Пропускаем role - это поле из таблицы users, обрабатывается отдельно
      if (updateData[key] !== undefined && key !== 'role') {
        paramCount++;
        const dbKey = key === 'firstName' ? 'first_name' : 
                     key === 'lastName' ? 'last_name' : 
                     key === 'middleName' ? 'middle_name' : 
                     key === 'isActive' ? 'is_active' :
                     key === 'managerId' ? 'manager_id' : key;
        updateFields.push(`${dbKey} = $${paramCount}`);
        values.push(updateData[key]);
      }
    });

    // Если есть поля для обновления в employees, обновляем их
    if (updateFields.length > 0) {
      values.push(id);
      await pool.query(
        `UPDATE employees SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount + 1}`,
        values
      );
    }

    // Если указана роль, обновляем её в таблице users
    if (roleToUpdate !== undefined) {
      const employeeEmail = updateData.email || existingEmployee.rows[0].email;
      const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [employeeEmail]);
      
      if (userResult.rows.length > 0) {
        // Пользователь существует - обновляем роль
        await pool.query(
          'UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2',
          [roleToUpdate, employeeEmail]
        );
        console.log(`✅ Роль пользователя ${employeeEmail} обновлена на ${roleToUpdate}`);
      } else {
        // Пользователь не существует - создаем его с указанной ролью
        const randomPassword = Math.random().toString(36).slice(-12);
        const hashedPassword = await bcrypt.hash(randomPassword, 10);
        
        await pool.query(
          'INSERT INTO users (email, password, role) VALUES ($1, $2, $3)',
          [employeeEmail, hashedPassword, roleToUpdate]
        );
        console.log(`✅ Пользователь ${employeeEmail} создан с ролью ${roleToUpdate}`);
      }
    }

    // Получаем обновленные данные сотрудника с ролью из users
    const updatedEmployee = await pool.query(
      `SELECT e.*, u.role as user_role 
       FROM employees e 
       LEFT JOIN users u ON e.email = u.email 
       WHERE e.id = $1`,
      [id]
    );

    res.json({
      message: 'Employee updated successfully',
      employee: updatedEmployee.rows[0]
    });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete employee (Admin only) - also deletes associated user
router.delete('/:id', authenticateToken, async (req: any, res: any) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;

    // Get employee with email
    const employeeResult = await pool.query('SELECT id, email FROM employees WHERE id = $1', [id]);

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const employee = employeeResult.rows[0];
    const employeeEmail = employee.email;

    // Check if we're trying to delete the current admin
    if (req.user?.email === employeeEmail) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    // Delete associated user if exists (this will cascade delete course_progress, lesson_progress)
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [employeeEmail]);
    if (userResult.rows.length > 0) {
      await pool.query('DELETE FROM users WHERE email = $1', [employeeEmail]);
    }

    // Deactivate employee
    await pool.query('UPDATE employees SET is_active = false WHERE id = $1', [id]);

    res.json({ message: 'Employee and associated user deleted successfully' });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;