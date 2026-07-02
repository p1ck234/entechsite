"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const pool_1 = require("../db/pool");
const auth_1 = require("../middleware/auth");
const googleDrive_1 = require("../services/googleDrive");
const router = express_1.default.Router();
router.get('/course/:courseId', auth_1.authenticateToken, async (req, res) => {
    try {
        const { courseId } = req.params;
        const userId = req.user.id;
        const lessonsResult = await pool_1.pool.query(`SELECT l.*, 
              lp.completed, lp.started_at, lp.completed_at
       FROM lessons l
       LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id AND lp.user_id = $1
       WHERE l.course_id = $2 AND l.is_active = true
       ORDER BY l.order_index ASC`, [userId, courseId]);
        const lessons = lessonsResult.rows.map(lesson => ({
            ...lesson,
            userProgress: {
                completed: lesson.completed || false,
                startedAt: lesson.started_at,
                completedAt: lesson.completed_at
            }
        }));
        res.json({ lessons });
    }
    catch (error) {
        console.error('Get lessons error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.get('/:id/materials', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const lessonResult = await pool_1.pool.query('SELECT id, title, google_drive_url FROM lessons WHERE id = $1 AND is_active = true', [id]);
        if (lessonResult.rows.length === 0) {
            return res.status(404).json({ message: 'Lesson not found' });
        }
        const lesson = lessonResult.rows[0];
        if (!lesson.google_drive_url) {
            return res.json({
                lessonId: String(lesson.id),
                title: lesson.title,
                materials: [],
            });
        }
        const materials = await (0, googleDrive_1.listLessonMaterialsInDriveResource)(lesson.google_drive_url);
        res.json({
            lessonId: String(lesson.id),
            title: lesson.title,
            materials: materials.map((item) => ({
                id: item.id,
                name: item.name,
                mimeType: item.mimeType,
                ref: (0, googleDrive_1.toDriveImageRef)(item.id),
                mediaType: (0, googleDrive_1.getDriveContentKind)(item.mimeType) || 'image',
            })),
        });
    }
    catch (error) {
        console.error('Get lesson materials error:', error);
        res.status(500).json({
            message: error?.message || 'Не удалось загрузить материалы урока',
        });
    }
});
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const lessonResult = await pool_1.pool.query(`SELECT l.*, 
              lp.completed, lp.started_at, lp.completed_at
       FROM lessons l
       LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id AND lp.user_id = $1
       WHERE l.id = $2`, [userId, id]);
        if (lessonResult.rows.length === 0) {
            return res.status(404).json({ message: 'Lesson not found' });
        }
        const lesson = lessonResult.rows[0];
        const lessonWithProgress = {
            ...lesson,
            userProgress: {
                completed: lesson.completed || false,
                startedAt: lesson.started_at,
                completedAt: lesson.completed_at
            }
        };
        res.json(lessonWithProgress);
    }
    catch (error) {
        console.error('Get lesson error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.post('/', auth_1.authenticateToken, [
    (0, express_validator_1.body)('courseId').isInt({ min: 1 }),
    (0, express_validator_1.body)('title').notEmpty().trim(),
    (0, express_validator_1.body)('description').optional().isString(),
    (0, express_validator_1.body)('googleDriveUrl').optional().isURL(),
    (0, express_validator_1.body)('duration').optional().isInt({ min: 1 }),
    (0, express_validator_1.body)('orderIndex').optional().isInt({ min: 0 })
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        if (req.user?.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Admin access required' });
        }
        const { courseId, title, description, googleDriveUrl, duration, orderIndex = 0 } = req.body;
        const courseResult = await pool_1.pool.query('SELECT id FROM courses WHERE id = $1', [courseId]);
        if (courseResult.rows.length === 0) {
            return res.status(404).json({ message: 'Course not found' });
        }
        const result = await pool_1.pool.query(`INSERT INTO lessons (course_id, title, description, google_drive_url, duration, order_index)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [courseId, title, description, googleDriveUrl, duration, orderIndex]);
        res.status(201).json({
            message: 'Lesson created successfully',
            lesson: result.rows[0]
        });
    }
    catch (error) {
        console.error('Create lesson error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.put('/:id', auth_1.authenticateToken, [
    (0, express_validator_1.body)('title').optional().notEmpty().trim(),
    (0, express_validator_1.body)('description').optional().isString(),
    (0, express_validator_1.body)('googleDriveUrl').optional().isURL(),
    (0, express_validator_1.body)('duration').optional().isInt({ min: 1 }),
    (0, express_validator_1.body)('orderIndex').optional().isInt({ min: 0 }),
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
        const lesson = await pool_1.pool.query('SELECT id FROM lessons WHERE id = $1', [id]);
        if (lesson.rows.length === 0) {
            return res.status(404).json({ message: 'Lesson not found' });
        }
        const updateFields = [];
        const values = [];
        let paramCount = 0;
        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined) {
                paramCount++;
                const dbKey = key === 'googleDriveUrl' ? 'google_drive_url' :
                    key === 'orderIndex' ? 'order_index' :
                        key === 'isActive' ? 'is_active' : key;
                updateFields.push(`${dbKey} = $${paramCount}`);
                values.push(updateData[key]);
            }
        });
        if (updateFields.length === 0) {
            return res.status(400).json({ message: 'No fields to update' });
        }
        values.push(id);
        const result = await pool_1.pool.query(`UPDATE lessons SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount + 1} RETURNING *`, values);
        res.json({
            message: 'Lesson updated successfully',
            lesson: result.rows[0]
        });
    }
    catch (error) {
        console.error('Update lesson error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        if (req.user?.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Admin access required' });
        }
        const { id } = req.params;
        const lesson = await pool_1.pool.query('SELECT id FROM lessons WHERE id = $1', [id]);
        if (lesson.rows.length === 0) {
            return res.status(404).json({ message: 'Lesson not found' });
        }
        await pool_1.pool.query('UPDATE lessons SET is_active = false WHERE id = $1', [id]);
        res.json({ message: 'Lesson deactivated successfully' });
    }
    catch (error) {
        console.error('Delete lesson error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.post('/:id/progress', auth_1.authenticateToken, [
    (0, express_validator_1.body)('completed').isBoolean()
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { id } = req.params;
        const { completed } = req.body;
        const userId = req.user.id;
        const lesson = await pool_1.pool.query('SELECT id, course_id FROM lessons WHERE id = $1', [id]);
        if (lesson.rows.length === 0) {
            return res.status(404).json({ message: 'Lesson not found' });
        }
        const courseId = lesson.rows[0].course_id;
        const result = await pool_1.pool.query(`INSERT INTO lesson_progress (user_id, lesson_id, completed, completed_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, lesson_id)
       DO UPDATE SET completed = $3, completed_at = $4
       RETURNING *`, [userId, id, completed, completed ? new Date() : null]);
        await updateCourseProgress(userId, courseId);
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
async function updateCourseProgress(userId, courseId) {
    try {
        const totalLessonsResult = await pool_1.pool.query('SELECT COUNT(*) FROM lessons WHERE course_id = $1 AND is_active = true', [courseId]);
        const totalLessons = parseInt(totalLessonsResult.rows[0].count);
        const completedLessonsResult = await pool_1.pool.query(`SELECT COUNT(*) FROM lesson_progress lp
       JOIN lessons l ON lp.lesson_id = l.id
       WHERE lp.user_id = $1 AND l.course_id = $2 AND lp.completed = true`, [userId, courseId]);
        const completedLessons = parseInt(completedLessonsResult.rows[0].count);
        const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
        const completed = progress === 100;
        await pool_1.pool.query(`INSERT INTO course_progress (user_id, course_id, progress, completed, completed_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, course_id)
       DO UPDATE SET progress = $3, completed = $4, completed_at = $5`, [userId, courseId, progress, completed, completed ? new Date() : null]);
    }
    catch (error) {
        console.error('Error updating course progress:', error);
    }
}
exports.default = router;
//# sourceMappingURL=lessons.js.map