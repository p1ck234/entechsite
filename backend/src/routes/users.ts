import express from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://p1ck23@localhost:5432/entechsite',
});

// Create user (Admin only) - creates both user and employee
router.post('/', authenticateToken, requireAdmin, [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['ADMIN', 'USER']),
  body('firstName').notEmpty().trim(),
  body('lastName').notEmpty().trim(),
  body('middleName').optional().isString().trim(),
  body('position').notEmpty().trim(),
  body('department').notEmpty().trim(),
  body('phone').notEmpty().trim(),
  body('telegram').optional().isString().trim(),
  body('photo').optional().isString()
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      email,
      password,
      role,
      firstName,
      lastName,
      middleName,
      position,
      department,
      phone,
      telegram,
      photo
    } = req.body;

    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Check if active employee already exists
    const existingEmployee = await pool.query('SELECT id FROM employees WHERE email = $1 AND is_active = true', [email]);
    if (existingEmployee.rows.length > 0) {
      return res.status(400).json({ message: 'Employee with this email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const userResult = await pool.query(
      'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id, email, role, created_at',
      [email, hashedPassword, role]
    );

    const user = userResult.rows[0];

    // Create employee
    const employeeResult = await pool.query(
      `INSERT INTO employees (first_name, last_name, middle_name, position, department, email, phone, telegram, photo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [firstName, lastName, middleName, position, department, email, phone, telegram, photo]
    );

    res.status(201).json({
      message: 'User and employee created successfully',
      user,
      employee: employeeResult.rows[0]
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all users (Admin only)
router.get('/', authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    const result = await pool.query(
      'SELECT id, email, role, created_at, updated_at FROM users ORDER BY created_at DESC'
    );

    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get pending registration requests (Admin only)
router.get('/pending-registrations', authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    const result = await pool.query(
      `SELECT id, first_name, last_name, middle_name, position, department, email, phone, telegram, status, created_at
       FROM employees 
       WHERE status = 'PENDING' 
       ORDER BY created_at DESC`
    );

    res.json({ registrations: result.rows });
  } catch (error) {
    console.error('Get pending registrations error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Approve registration (Admin only)
router.post('/approve-registration/:id', authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    const { id } = req.params;

    // Проверяем, существует ли заявка
    const employeeResult = await pool.query(
      'SELECT * FROM employees WHERE id = $1',
      [id]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ message: 'Заявка не найдена' });
    }

    const employee = employeeResult.rows[0];

    if (employee.status !== 'PENDING') {
      return res.status(400).json({ message: `Заявка уже обработана. Текущий статус: ${employee.status}` });
    }

    // Обновляем статус на APPROVED и активируем сотрудника
    await pool.query(
      'UPDATE employees SET status = $1, is_active = $2 WHERE id = $3',
      ['APPROVED', true, id]
    );

    // Создаем пользователя, если его еще нет
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [employee.email]);
    
    if (userResult.rows.length === 0) {
      const randomPassword = Math.random().toString(36).slice(-12);
      const hashedPassword = await bcrypt.hash(randomPassword, 12);
      
      await pool.query(
        'INSERT INTO users (email, password, role) VALUES ($1, $2, $3)',
        [employee.email, hashedPassword, 'USER']
      );
    }

    console.log('✅ Заявка одобрена:', {
      employeeId: id,
      email: employee.email,
      telegram: employee.telegram
    });

    res.json({ 
      message: 'Заявка успешно одобрена',
      employee: {
        ...employee,
        status: 'APPROVED',
        is_active: true
      }
    });
  } catch (error) {
    console.error('Approve registration error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Reject registration (Admin only)
router.post('/reject-registration/:id', authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    const { id } = req.params;

    // Проверяем, существует ли заявка
    const employeeResult = await pool.query(
      'SELECT * FROM employees WHERE id = $1',
      [id]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ message: 'Заявка не найдена' });
    }

    const employee = employeeResult.rows[0];

    if (employee.status !== 'PENDING') {
      return res.status(400).json({ message: `Заявка уже обработана. Текущий статус: ${employee.status}` });
    }

    // Обновляем статус на REJECTED
    await pool.query(
      'UPDATE employees SET status = $1, is_active = $2 WHERE id = $3',
      ['REJECTED', false, id]
    );

    console.log('❌ Заявка отклонена:', {
      employeeId: id,
      email: employee.email,
      telegram: employee.telegram
    });

    res.json({ 
      message: 'Заявка отклонена',
      employee: {
        ...employee,
        status: 'REJECTED',
        is_active: false
      }
    });
  } catch (error) {
    console.error('Reject registration error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get user by ID (Admin only)
router.get('/:id', authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT id, email, role, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update user role (Admin only)
router.put('/:id/role', authenticateToken, requireAdmin, [
  body('role').isIn(['ADMIN', 'USER'])
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { role } = req.body;

    // Prevent admin from changing their own role
    if (id === req.user?.id) {
      return res.status(400).json({ message: 'Cannot change your own role' });
    }

    const user = await pool.query('SELECT id FROM users WHERE id = $1', [id]);

    if (user.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const result = await pool.query(
      'UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, email, role, updated_at',
      [role, id]
    );

    res.json({
      message: 'User role updated successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Admin change user password by email (Admin only)
router.put('/password-by-email', authenticateToken, requireAdmin, [
  body('email').isEmail().normalizeEmail(),
  body('newPassword').isLength({ min: 6 })
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, newPassword } = req.body;

    // Check if user exists
    const user = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);
    if (user.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await pool.query(
      'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2',
      [hashedPassword, email]
    );

    res.json({ 
      message: 'Password changed successfully',
      email: email
    });
  } catch (error) {
    console.error('Admin change password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Change password (for current user)
router.put('/change-password', authenticateToken, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    const result = await pool.query('SELECT password FROM users WHERE id = $1', [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, result.rows[0].password);
    if (!isValidPassword) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    await pool.query(
      'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedNewPassword, userId]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete user (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (id === req.user?.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    const user = await pool.query('SELECT id FROM users WHERE id = $1', [id]);

    if (user.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;