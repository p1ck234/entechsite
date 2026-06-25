"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const pg_1 = require("pg");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://p1ck23@localhost:5432/entechsite',
});
const normalizeTelegramUsername = (username) => {
    if (!username) {
        return null;
    }
    const normalized = username.trim().replace(/^@+/, '').toLowerCase();
    return normalized.length > 0 ? normalized : null;
};
router.get('/', auth_1.authenticateToken, [
    (0, express_validator_1.query)('page').optional().isInt({ min: 1 }),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 }),
    (0, express_validator_1.query)('search').optional().isString(),
    (0, express_validator_1.query)('department').optional().isString(),
    (0, express_validator_1.query)('showInactive').optional().isBoolean(),
    (0, express_validator_1.query)('status').optional().isIn(['APPROVED', 'PENDING', 'REJECTED'])
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search;
        const department = req.query.department;
        const showInactive = req.query.showInactive === 'true' && req.user?.role === 'ADMIN';
        const statusFilter = req.query.status;
        const skip = (page - 1) * limit;
        let whereClause = '';
        const params = [];
        let paramCount = 0;
        if (statusFilter === 'PENDING') {
            paramCount++;
            whereClause = `WHERE e.status = $${paramCount}`;
            params.push('PENDING');
        }
        else if (statusFilter === 'REJECTED') {
            paramCount++;
            whereClause = `WHERE (e.status = $${paramCount} OR e.is_active = false)`;
            params.push('REJECTED');
        }
        else {
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
            pool.query(`SELECT e.*, u.role as user_role 
         FROM employees e 
         LEFT JOIN users u ON e.email = u.email 
         ${whereClause} 
         ORDER BY e.first_name ASC 
         LIMIT $${limitParam} OFFSET $${offsetParam}`, queryParams),
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
    }
    catch (error) {
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
router.get('/me', auth_1.authenticateToken, async (req, res) => {
    try {
        if (!req.user?.email) {
            return res.status(401).json({ message: 'User email not found' });
        }
        const result = await pool.query(`SELECT e.*, u.role as user_role 
       FROM employees e 
       LEFT JOIN users u ON e.email = u.email 
       WHERE e.email = $1 
       ORDER BY e.is_active DESC, e.created_at DESC 
       LIMIT 1`, [req.user.email]);
        if (result.rows.length === 0) {
            return res.status(404).json({
                message: 'Employee not found for this user',
                email: req.user.email
            });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Get current employee error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`SELECT e.*, u.role as user_role 
       FROM employees e 
       LEFT JOIN users u ON e.email = u.email 
       WHERE e.id = $1`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Employee not found' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Get employee error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.post('/', auth_1.authenticateToken, [
    (0, express_validator_1.body)('firstName').notEmpty().trim(),
    (0, express_validator_1.body)('lastName').notEmpty().trim(),
    (0, express_validator_1.body)('position').notEmpty().trim(),
    (0, express_validator_1.body)('department').notEmpty().trim(),
    (0, express_validator_1.body)('email').isEmail().normalizeEmail(),
    (0, express_validator_1.body)('phone').notEmpty().trim(),
    (0, express_validator_1.body)('telegram').optional().isString(),
    (0, express_validator_1.body)('photo').optional().isString()
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        if (req.user?.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Admin access required' });
        }
        const { firstName, lastName, middleName, position, department, email, phone, telegram, photo } = req.body;
        const normalizedTelegram = normalizeTelegramUsername(telegram);
        const existingEmployee = await pool.query('SELECT id FROM employees WHERE email = $1 AND is_active = true', [email]);
        if (existingEmployee.rows.length > 0) {
            return res.status(400).json({ message: 'Employee with this email already exists' });
        }
        const result = await pool.query(`INSERT INTO employees (first_name, last_name, middle_name, position, department, email, phone, telegram, photo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`, [firstName, lastName, middleName, position, department, email, phone, normalizedTelegram, photo]);
        res.status(201).json({
            message: 'Employee created successfully',
            employee: result.rows[0]
        });
    }
    catch (error) {
        console.error('Create employee error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.put('/:id', auth_1.authenticateToken, [
    (0, express_validator_1.body)('firstName').optional().notEmpty().trim(),
    (0, express_validator_1.body)('lastName').optional().notEmpty().trim(),
    (0, express_validator_1.body)('position').optional().notEmpty().trim(),
    (0, express_validator_1.body)('department').optional().notEmpty().trim(),
    (0, express_validator_1.body)('email').optional().isEmail().normalizeEmail(),
    (0, express_validator_1.body)('phone').optional().notEmpty().trim(),
    (0, express_validator_1.body)('telegram').optional().isString(),
    (0, express_validator_1.body)('photo').optional().isString(),
    (0, express_validator_1.body)('isActive').optional().isBoolean(),
    (0, express_validator_1.body)('role').optional().isIn(['ADMIN', 'USER'])
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
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
        const existingEmployee = await pool.query('SELECT * FROM employees WHERE id = $1', [id]);
        if (existingEmployee.rows.length === 0) {
            return res.status(404).json({ message: 'Employee not found' });
        }
        if (updateData.email && updateData.email !== existingEmployee.rows[0].email) {
            const emailConflict = await pool.query('SELECT id FROM employees WHERE email = $1', [updateData.email]);
            if (emailConflict.rows.length > 0) {
                return res.status(400).json({ message: 'Employee with this email already exists' });
            }
        }
        const updateFields = [];
        const values = [];
        let paramCount = 0;
        const roleToUpdate = updateData.role;
        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined && key !== 'role') {
                paramCount++;
                const dbKey = key === 'firstName' ? 'first_name' :
                    key === 'lastName' ? 'last_name' :
                        key === 'middleName' ? 'middle_name' :
                            key === 'isActive' ? 'is_active' : key;
                updateFields.push(`${dbKey} = $${paramCount}`);
                values.push(updateData[key]);
            }
        });
        if (updateFields.length > 0) {
            values.push(id);
            await pool.query(`UPDATE employees SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount + 1}`, values);
        }
        if (roleToUpdate !== undefined) {
            const employeeEmail = updateData.email || existingEmployee.rows[0].email;
            const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [employeeEmail]);
            if (userResult.rows.length > 0) {
                await pool.query('UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2', [roleToUpdate, employeeEmail]);
                console.log(`✅ Роль пользователя ${employeeEmail} обновлена на ${roleToUpdate}`);
            }
            else {
                const randomPassword = Math.random().toString(36).slice(-12);
                const hashedPassword = await bcryptjs_1.default.hash(randomPassword, 10);
                await pool.query('INSERT INTO users (email, password, role) VALUES ($1, $2, $3)', [employeeEmail, hashedPassword, roleToUpdate]);
                console.log(`✅ Пользователь ${employeeEmail} создан с ролью ${roleToUpdate}`);
            }
        }
        const updatedEmployee = await pool.query(`SELECT e.*, u.role as user_role 
       FROM employees e 
       LEFT JOIN users u ON e.email = u.email 
       WHERE e.id = $1`, [id]);
        res.json({
            message: 'Employee updated successfully',
            employee: updatedEmployee.rows[0]
        });
    }
    catch (error) {
        console.error('Update employee error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        if (req.user?.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Admin access required' });
        }
        const { id } = req.params;
        const employeeResult = await pool.query('SELECT id, email FROM employees WHERE id = $1', [id]);
        if (employeeResult.rows.length === 0) {
            return res.status(404).json({ message: 'Employee not found' });
        }
        const employee = employeeResult.rows[0];
        const employeeEmail = employee.email;
        if (req.user?.email === employeeEmail) {
            return res.status(400).json({ message: 'Cannot delete your own account' });
        }
        const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [employeeEmail]);
        if (userResult.rows.length > 0) {
            await pool.query('DELETE FROM users WHERE email = $1', [employeeEmail]);
        }
        await pool.query('UPDATE employees SET is_active = false WHERE id = $1', [id]);
        res.json({ message: 'Employee and associated user deleted successfully' });
    }
    catch (error) {
        console.error('Delete employee error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=employees.js.map