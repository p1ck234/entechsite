"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const pg_1 = require("pg");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://p1ck23@localhost:5432/entechsite',
});
router.post('/', auth_1.authenticateToken, auth_1.requireAdmin, [
    (0, express_validator_1.body)('email').isEmail().normalizeEmail(),
    (0, express_validator_1.body)('password').isLength({ min: 6 }),
    (0, express_validator_1.body)('role').isIn(['ADMIN', 'USER']),
    (0, express_validator_1.body)('firstName').notEmpty().trim(),
    (0, express_validator_1.body)('lastName').notEmpty().trim(),
    (0, express_validator_1.body)('middleName').optional().isString().trim(),
    (0, express_validator_1.body)('position').notEmpty().trim(),
    (0, express_validator_1.body)('department').notEmpty().trim(),
    (0, express_validator_1.body)('phone').notEmpty().trim(),
    (0, express_validator_1.body)('telegram').optional().isString().trim(),
    (0, express_validator_1.body)('photo').optional().isString()
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { email, password, role, firstName, lastName, middleName, position, department, phone, telegram, photo } = req.body;
        const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }
        const existingEmployee = await pool.query('SELECT id FROM employees WHERE email = $1 AND is_active = true', [email]);
        if (existingEmployee.rows.length > 0) {
            return res.status(400).json({ message: 'Employee with this email already exists' });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 12);
        const userResult = await pool.query('INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id, email, role, created_at', [email, hashedPassword, role]);
        const user = userResult.rows[0];
        const employeeResult = await pool.query(`INSERT INTO employees (first_name, last_name, middle_name, position, department, email, phone, telegram, photo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`, [firstName, lastName, middleName, position, department, email, phone, telegram, photo]);
        res.status(201).json({
            message: 'User and employee created successfully',
            user,
            employee: employeeResult.rows[0]
        });
    }
    catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.get('/', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, email, role, created_at, updated_at FROM users ORDER BY created_at DESC');
        res.json({ users: result.rows });
    }
    catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.get('/:id', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT id, email, role, created_at, updated_at FROM users WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ user: result.rows[0] });
    }
    catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.put('/:id/role', auth_1.authenticateToken, auth_1.requireAdmin, [
    (0, express_validator_1.body)('role').isIn(['ADMIN', 'USER'])
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { id } = req.params;
        const { role } = req.body;
        if (id === req.user?.id) {
            return res.status(400).json({ message: 'Cannot change your own role' });
        }
        const user = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
        if (user.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const result = await pool.query('UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, email, role, updated_at', [role, id]);
        res.json({
            message: 'User role updated successfully',
            user: result.rows[0]
        });
    }
    catch (error) {
        console.error('Update user role error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.put('/password-by-email', auth_1.authenticateToken, auth_1.requireAdmin, [
    (0, express_validator_1.body)('email').isEmail().normalizeEmail(),
    (0, express_validator_1.body)('newPassword').isLength({ min: 6 })
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { email, newPassword } = req.body;
        const user = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);
        if (user.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const hashedPassword = await bcryptjs_1.default.hash(newPassword, 12);
        await pool.query('UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2', [hashedPassword, email]);
        res.json({
            message: 'Password changed successfully',
            email: email
        });
    }
    catch (error) {
        console.error('Admin change password error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.put('/change-password', auth_1.authenticateToken, [
    (0, express_validator_1.body)('currentPassword').notEmpty(),
    (0, express_validator_1.body)('newPassword').isLength({ min: 6 })
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;
        const result = await pool.query('SELECT password FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const isValidPassword = await bcryptjs_1.default.compare(currentPassword, result.rows[0].password);
        if (!isValidPassword) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }
        const hashedNewPassword = await bcryptjs_1.default.hash(newPassword, 12);
        await pool.query('UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hashedNewPassword, userId]);
        res.json({ message: 'Password changed successfully' });
    }
    catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.delete('/:id', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        if (id === req.user?.id) {
            return res.status(400).json({ message: 'Cannot delete your own account' });
        }
        const user = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
        if (user.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        res.json({ message: 'User deleted successfully' });
    }
    catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=users.js.map