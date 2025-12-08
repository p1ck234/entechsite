"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const pg_1 = require("pg");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://p1ck23@localhost:5432/entechsite',
});
router.get('/', auth_1.authenticateToken, [
    (0, express_validator_1.query)('page').optional().isInt({ min: 1 }),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 }),
    (0, express_validator_1.query)('search').optional().isString()
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const search = req.query.search;
        const skip = (page - 1) * limit;
        let whereClause = 'WHERE is_active = true';
        const params = [];
        let paramCount = 0;
        if (search) {
            paramCount++;
            whereClause += ` AND (name ILIKE $${paramCount} OR username ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }
        const [botsResult, totalResult] = await Promise.all([
            pool.query(`SELECT * FROM bots ${whereClause} ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`, [...params, limit, skip]),
            pool.query(`SELECT COUNT(*) FROM bots ${whereClause}`, params)
        ]);
        const bots = botsResult.rows;
        const total = parseInt(totalResult.rows[0].count);
        res.json({
            bots,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        console.error('Get bots error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM bots WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Bot not found' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Get bot error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.post('/', auth_1.authenticateToken, auth_1.requireAdmin, [
    (0, express_validator_1.body)('name').notEmpty().withMessage('Name is required'),
    (0, express_validator_1.body)('username').notEmpty().withMessage('Username is required'),
    (0, express_validator_1.body)('description').optional().isString(),
    (0, express_validator_1.body)('is_active').optional().isBoolean()
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { name, username, description, is_active = true } = req.body;
        const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
        const result = await pool.query(`INSERT INTO bots (name, username, description, is_active) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`, [name, cleanUsername, description || null, is_active]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error('Create bot error:', error);
        if (error.code === '23505') {
            return res.status(400).json({ message: 'Bot with this username already exists' });
        }
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.put('/:id', auth_1.authenticateToken, auth_1.requireAdmin, [
    (0, express_validator_1.body)('name').optional().notEmpty(),
    (0, express_validator_1.body)('username').optional().notEmpty(),
    (0, express_validator_1.body)('description').optional().isString(),
    (0, express_validator_1.body)('is_active').optional().isBoolean()
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { id } = req.params;
        const { name, username, description, is_active } = req.body;
        const existingBot = await pool.query('SELECT * FROM bots WHERE id = $1', [id]);
        if (existingBot.rows.length === 0) {
            return res.status(404).json({ message: 'Bot not found' });
        }
        const updates = [];
        const values = [];
        let paramCount = 1;
        if (name !== undefined) {
            updates.push(`name = $${paramCount++}`);
            values.push(name);
        }
        if (username !== undefined) {
            const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
            updates.push(`username = $${paramCount++}`);
            values.push(cleanUsername);
        }
        if (description !== undefined) {
            updates.push(`description = $${paramCount++}`);
            values.push(description || null);
        }
        if (is_active !== undefined) {
            updates.push(`is_active = $${paramCount++}`);
            values.push(is_active);
        }
        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);
        const result = await pool.query(`UPDATE bots SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`, values);
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Update bot error:', error);
        if (error.code === '23505') {
            return res.status(400).json({ message: 'Bot with this username already exists' });
        }
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.delete('/:id', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM bots WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Bot not found' });
        }
        res.json({ message: 'Bot deleted successfully' });
    }
    catch (error) {
        console.error('Delete bot error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=bots.js.map