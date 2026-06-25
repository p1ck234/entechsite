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
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search;
        const skip = (page - 1) * limit;
        let whereClause = 'WHERE is_active = true';
        let coursesWhereClause = 'WHERE c.is_active = true';
        const params = [];
        let paramCount = 0;
        if (search) {
            paramCount++;
            whereClause += ` AND (title ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
            coursesWhereClause += ` AND (c.title ILIKE $${paramCount} OR c.description ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }
        const [coursesResult, totalResult] = await Promise.all([
            pool.query(`SELECT c.*, cp.progress, cp.completed
         FROM courses c
         LEFT JOIN course_progress cp ON cp.course_id = c.id AND cp.user_id = $${paramCount + 1}
         ${coursesWhereClause}
         ORDER BY c.created_at DESC
         LIMIT $${paramCount + 2} OFFSET $${paramCount + 3}`, [...params, req.user.id, limit, skip]),
            pool.query(`SELECT COUNT(*) FROM courses ${whereClause}`, params)
        ]);
        const courses = coursesResult.rows;
        const total = parseInt(totalResult.rows[0].count);
        const coursesWithProgress = courses.map((course) => ({
            ...course,
            userProgress: {
                progress: course.progress ?? 0,
                completed: course.completed ?? false,
            }
        }));
        res.json({
            courses: coursesWithProgress,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        console.error('Get courses error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const courseResult = await pool.query('SELECT * FROM courses WHERE id = $1', [id]);
        if (courseResult.rows.length === 0) {
            return res.status(404).json({ message: 'Course not found' });
        }
        const course = courseResult.rows[0];
        const progressResult = await pool.query('SELECT progress, completed, started_at, completed_at FROM course_progress WHERE user_id = $1 AND course_id = $2', [req.user.id, id]);
        const courseWithProgress = {
            ...course,
            userProgress: progressResult.rows[0] || { progress: 0, completed: false, started_at: null, completed_at: null }
        };
        res.json(courseWithProgress);
    }
    catch (error) {
        console.error('Get course error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.post('/', auth_1.authenticateToken, [
    (0, express_validator_1.body)('title').notEmpty().trim(),
    (0, express_validator_1.body)('description').optional().isString(),
    (0, express_validator_1.body)('googleDriveUrl').isURL(),
    (0, express_validator_1.body)('duration').optional().isInt({ min: 1 })
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        if (req.user?.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Admin access required' });
        }
        const { title, description, googleDriveUrl, duration } = req.body;
        const result = await pool.query('INSERT INTO courses (title, description, google_drive_url, duration) VALUES ($1, $2, $3, $4) RETURNING *', [title, description, googleDriveUrl, duration]);
        res.status(201).json({
            message: 'Course created successfully',
            course: result.rows[0]
        });
    }
    catch (error) {
        console.error('Create course error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.put('/:id', auth_1.authenticateToken, [
    (0, express_validator_1.body)('title').optional().notEmpty().trim(),
    (0, express_validator_1.body)('description').optional().isString(),
    (0, express_validator_1.body)('googleDriveUrl').optional().isURL(),
    (0, express_validator_1.body)('duration').optional().isInt({ min: 1 }),
    (0, express_validator_1.body)('isActive').optional().isBoolean()
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
        const course = await pool.query('SELECT id FROM courses WHERE id = $1', [id]);
        if (course.rows.length === 0) {
            return res.status(404).json({ message: 'Course not found' });
        }
        const updateFields = [];
        const values = [];
        let paramCount = 0;
        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined) {
                paramCount++;
                const dbKey = key === 'googleDriveUrl' ? 'google_drive_url' :
                    key === 'isActive' ? 'is_active' : key;
                updateFields.push(`${dbKey} = $${paramCount}`);
                values.push(updateData[key]);
            }
        });
        if (updateFields.length === 0) {
            return res.status(400).json({ message: 'No fields to update' });
        }
        values.push(id);
        const result = await pool.query(`UPDATE courses SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount + 1} RETURNING *`, values);
        res.json({
            message: 'Course updated successfully',
            course: result.rows[0]
        });
    }
    catch (error) {
        console.error('Update course error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        if (req.user?.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Admin access required' });
        }
        const { id } = req.params;
        const course = await pool.query('SELECT id FROM courses WHERE id = $1', [id]);
        if (course.rows.length === 0) {
            return res.status(404).json({ message: 'Course not found' });
        }
        await pool.query('UPDATE courses SET is_active = false WHERE id = $1', [id]);
        res.json({ message: 'Course deactivated successfully' });
    }
    catch (error) {
        console.error('Delete course error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.post('/:id/progress', auth_1.authenticateToken, [
    (0, express_validator_1.body)('progress').isInt({ min: 0, max: 100 }),
    (0, express_validator_1.body)('completed').optional().isBoolean()
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { id } = req.params;
        const { progress, completed = false } = req.body;
        const userId = req.user.id;
        const course = await pool.query('SELECT id FROM courses WHERE id = $1', [id]);
        if (course.rows.length === 0) {
            return res.status(404).json({ message: 'Course not found' });
        }
        const result = await pool.query(`INSERT INTO course_progress (user_id, course_id, progress, completed, completed_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, course_id)
       DO UPDATE SET progress = $3, completed = $4, completed_at = $5
       RETURNING *`, [userId, id, progress, completed, completed ? new Date() : null]);
        res.json({
            message: 'Progress updated successfully',
            progress: result.rows[0]
        });
    }
    catch (error) {
        console.error('Update progress error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.get('/progress/user', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'User not authenticated' });
        }
        const result = await pool.query(`SELECT cp.*, c.title, c.description, c.duration, c.google_drive_url
       FROM course_progress cp
       JOIN courses c ON cp.course_id = c.id
       WHERE cp.user_id = $1
       ORDER BY cp.started_at DESC`, [userId]);
        res.json({ progress: result.rows });
    }
    catch (error) {
        console.error('Get user progress error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=courses.js.map