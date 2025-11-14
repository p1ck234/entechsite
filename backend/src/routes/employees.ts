import express from 'express';
import { body, validationResult, query } from 'express-validator';
import { Pool } from 'pg';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://p1ck23@localhost:5432/entechsite',
});

// Get all employees
router.get('/', authenticateToken, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString(),
  query('department').optional().isString(),
  query('showInactive').optional().isBoolean()
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
    const skip = (page - 1) * limit;

    let whereClause = showInactive ? 'WHERE is_active = false' : 'WHERE is_active = true';
    const params: any[] = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      whereClause += ` AND (first_name ILIKE $${paramCount} OR last_name ILIKE $${paramCount} OR position ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    if (department) {
      paramCount++;
      whereClause += ` AND department ILIKE $${paramCount}`;
      params.push(`%${department}%`);
    }

    const [employeesResult, totalResult] = await Promise.all([
      pool.query(
        `SELECT e.*, u.role as user_role 
         FROM employees e 
         LEFT JOIN users u ON e.email = u.email 
         ${whereClause} 
         ORDER BY e.first_name ASC 
         LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
        [...params, limit, skip]
      ),
      pool.query(`SELECT COUNT(*) FROM employees ${whereClause}`, params)
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
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ message: 'Internal server error' });
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
      return res.status(404).json({ message: 'Employee not found for this user' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get current employee error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

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
  body('photo').optional().isString()
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
      photo
    } = req.body;

    // Check if active employee with email already exists
    const existingEmployee = await pool.query('SELECT id FROM employees WHERE email = $1 AND is_active = true', [email]);

    if (existingEmployee.rows.length > 0) {
      return res.status(400).json({ message: 'Employee with this email already exists' });
    }

    const result = await pool.query(
      `INSERT INTO employees (first_name, last_name, middle_name, position, department, email, phone, telegram, photo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [firstName, lastName, middleName, position, department, email, phone, telegram, photo]
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
  body('isActive').optional().isBoolean()
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

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        paramCount++;
        const dbKey = key === 'firstName' ? 'first_name' : 
                     key === 'lastName' ? 'last_name' : 
                     key === 'middleName' ? 'middle_name' : 
                     key === 'isActive' ? 'is_active' : key;
        updateFields.push(`${dbKey} = $${paramCount}`);
        values.push(updateData[key]);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE employees SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount + 1} RETURNING *`,
      values
    );

    res.json({
      message: 'Employee updated successfully',
      employee: result.rows[0]
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