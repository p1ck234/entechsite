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
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const [eventsResult, totalResult] = await Promise.all([
            pool.query(`SELECT * FROM events 
         WHERE is_active = true 
         ORDER BY event_date DESC NULLS LAST, created_at DESC 
         LIMIT $1 OFFSET $2`, [limit, skip]),
            pool.query('SELECT COUNT(*) FROM events WHERE is_active = true')
        ]);
        const events = eventsResult.rows;
        const total = parseInt(totalResult.rows[0].count);
        res.json({
            events,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        console.error('Get events error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Event not found' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Get event error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.post('/', auth_1.authenticateToken, [
    (0, express_validator_1.body)('title').notEmpty().trim(),
    (0, express_validator_1.body)('googleDriveUrl').isURL(),
    (0, express_validator_1.body)('previewImages').optional().isArray(),
    (0, express_validator_1.body)('description').optional().isString(),
    (0, express_validator_1.body)('eventDate').optional().isISO8601(),
], async (req, res) => {
    try {
        if (req.user?.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Admin access required' });
        }
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { title, description, googleDriveUrl, previewImages = [], eventDate } = req.body;
        const result = await pool.query(`INSERT INTO events (title, description, google_drive_url, preview_images, event_date)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`, [title, description, googleDriveUrl, previewImages, eventDate || null]);
        res.status(201).json({
            message: 'Event created successfully',
            event: result.rows[0]
        });
    }
    catch (error) {
        console.error('Create event error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.put('/:id', auth_1.authenticateToken, [
    (0, express_validator_1.body)('title').optional().notEmpty().trim(),
    (0, express_validator_1.body)('googleDriveUrl').optional().isURL(),
    (0, express_validator_1.body)('previewImages').optional().isArray(),
    (0, express_validator_1.body)('description').optional().isString(),
    (0, express_validator_1.body)('eventDate').optional().isISO8601(),
    (0, express_validator_1.body)('isActive').optional().isBoolean(),
], async (req, res) => {
    try {
        if (req.user?.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Admin access required' });
        }
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { id } = req.params;
        const updateData = req.body;
        const existingEvent = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
        if (existingEvent.rows.length === 0) {
            return res.status(404).json({ message: 'Event not found' });
        }
        const updateFields = [];
        const values = [];
        let paramCount = 0;
        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined) {
                paramCount++;
                const dbKey = key === 'googleDriveUrl' ? 'google_drive_url' :
                    key === 'previewImages' ? 'preview_images' :
                        key === 'eventDate' ? 'event_date' :
                            key === 'isActive' ? 'is_active' : key;
                updateFields.push(`${dbKey} = $${paramCount}`);
                values.push(updateData[key]);
            }
        });
        if (updateFields.length === 0) {
            return res.status(400).json({ message: 'No fields to update' });
        }
        values.push(id);
        const result = await pool.query(`UPDATE events SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount + 1} RETURNING *`, values);
        res.json({
            message: 'Event updated successfully',
            event: result.rows[0]
        });
    }
    catch (error) {
        console.error('Update event error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        if (req.user?.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Admin access required' });
        }
        const { id } = req.params;
        const event = await pool.query('SELECT id FROM events WHERE id = $1', [id]);
        if (event.rows.length === 0) {
            return res.status(404).json({ message: 'Event not found' });
        }
        await pool.query('UPDATE events SET is_active = false WHERE id = $1', [id]);
        res.json({ message: 'Event deleted successfully' });
    }
    catch (error) {
        console.error('Delete event error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=events.js.map