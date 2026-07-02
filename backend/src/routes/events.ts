import express from 'express';
import { body, validationResult, query } from 'express-validator';
import { Pool } from 'pg';
import { authenticateToken } from '../middleware/auth';
import { getDriveMediaKind, listMediaInDriveResource, toDriveImageRef } from '../services/googleDrive';

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://p1ck23@localhost:5432/entechsite',
});

// Get all events
router.get('/', authenticateToken, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [eventsResult, totalResult] = await Promise.all([
      pool.query(
        `SELECT * FROM events 
         WHERE is_active = true 
         ORDER BY event_date DESC NULLS LAST, created_at DESC 
         LIMIT $1 OFFSET $2`,
        [limit, skip]
      ),
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
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get event media from Google Drive folder
router.get('/:id/photos', authenticateToken, async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT id, title, google_drive_url FROM events WHERE id = $1 AND is_active = true',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const event = result.rows[0];
    const mediaItems = await listMediaInDriveResource(event.google_drive_url);

    res.json({
      eventId: String(event.id),
      title: event.title,
      photos: mediaItems.map((item) => ({
        id: item.id,
        name: item.name,
        mimeType: item.mimeType,
        ref: toDriveImageRef(item.id),
        mediaType: getDriveMediaKind(item.mimeType) || 'image',
      })),
    });
  } catch (error: any) {
    console.error('Get event photos error:', error);
    res.status(500).json({
      message: error?.message || 'Не удалось загрузить медиафайлы мероприятия',
    });
  }
});

// Get event by ID
router.get('/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT * FROM events WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create event (Admin only)
router.post('/', authenticateToken, [
  body('title').notEmpty().trim(),
  body('googleDriveUrl').isURL(),
  body('previewImages').optional().isArray(),
  body('description').optional().isString(),
  body('eventDate').optional().isISO8601(),
], async (req: any, res: any) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      description,
      googleDriveUrl,
      previewImages = [],
      eventDate
    } = req.body;

    const result = await pool.query(
      `INSERT INTO events (title, description, google_drive_url, preview_images, event_date)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [title, description, googleDriveUrl, previewImages, eventDate || null]
    );

    res.status(201).json({
      message: 'Event created successfully',
      event: result.rows[0]
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update event (Admin only)
router.put('/:id', authenticateToken, [
  body('title').optional().notEmpty().trim(),
  body('googleDriveUrl').optional().isURL(),
  body('previewImages').optional().isArray(),
  body('description').optional().isString(),
  body('eventDate').optional().isISO8601(),
  body('isActive').optional().isBoolean(),
], async (req: any, res: any) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updateData = req.body;

    // Check if event exists
    const existingEvent = await pool.query('SELECT * FROM events WHERE id = $1', [id]);

    if (existingEvent.rows.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const values: any[] = [];
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
    const result = await pool.query(
      `UPDATE events SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount + 1} RETURNING *`,
      values
    );

    res.json({
      message: 'Event updated successfully',
      event: result.rows[0]
    });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete event (Admin only)
router.delete('/:id', authenticateToken, async (req: any, res: any) => {
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
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;

