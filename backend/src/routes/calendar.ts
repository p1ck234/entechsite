import express from 'express';
import { body, validationResult, query } from 'express-validator';
import { pool } from '../db/pool';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Get calendar events for a date range
router.get('/', authenticateToken, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('month').optional().isInt({ min: 1, max: 12 }),
  query('year').optional().isInt({ min: 2000, max: 2100 }),
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    let startDate: string;
    let endDate: string;

    if (req.query.startDate && req.query.endDate) {
      startDate = req.query.startDate;
      endDate = req.query.endDate;
    } else if (req.query.month && req.query.year) {
      const month = parseInt(req.query.month);
      const year = parseInt(req.query.year);
      startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else {
      // Default to current month
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }

    const result = await pool.query(
      `SELECT 
         ce.id,
         ce.title,
         ce.description,
         TO_CHAR(ce.event_date, 'YYYY-MM-DD') as event_date,
         CASE WHEN ce.event_time IS NOT NULL THEN TO_CHAR(ce.event_time, 'HH24:MI') ELSE NULL END as event_time,
         ce.location,
         ce.is_all_day,
         ce.created_by,
         ce.created_at,
         ce.updated_at,
         u.email as created_by_email
       FROM calendar_events ce
       LEFT JOIN users u ON ce.created_by = u.id
       WHERE ce.event_date >= $1 AND ce.event_date <= $2
       ORDER BY ce.event_date ASC, ce.event_time ASC NULLS LAST`,
      [startDate, endDate]
    );

    res.json({ events: result.rows });
  } catch (error) {
    console.error('Get calendar events error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get calendar event by ID
router.get('/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
         ce.id,
         ce.title,
         ce.description,
         TO_CHAR(ce.event_date, 'YYYY-MM-DD') as event_date,
         CASE WHEN ce.event_time IS NOT NULL THEN TO_CHAR(ce.event_time, 'HH24:MI') ELSE NULL END as event_time,
         ce.location,
         ce.is_all_day,
         ce.created_by,
         ce.created_at,
         ce.updated_at,
         u.email as created_by_email
       FROM calendar_events ce
       LEFT JOIN users u ON ce.created_by = u.id
       WHERE ce.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get calendar event error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create calendar event (Admin only)
router.post('/', authenticateToken, [
  body('title').notEmpty().trim(),
  body('eventDate').notEmpty().isString(),
  body('description').optional().isString().trim(),
  body('eventTime').optional().isString(),
  body('location').optional().isString().trim(),
  body('isAllDay').optional().isBoolean(),
], async (req: any, res: any) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      description,
      eventDate,
      eventTime,
      location,
      isAllDay = false
    } = req.body;

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      return res.status(400).json({ message: 'Invalid date format. Expected YYYY-MM-DD' });
    }

    // Validate time format if provided
    if (eventTime && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(eventTime)) {
      return res.status(400).json({ message: 'Invalid time format. Expected HH:MM' });
    }

    console.log('Creating calendar event:', { 
      title, 
      eventDate, 
      eventTime, 
      isAllDay, 
      description, 
      location, 
      userId: req.user?.id,
      user: req.user
    });

    if (!req.user || !req.user.id) {
      console.error('User not found in request');
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const result = await pool.query(
      `INSERT INTO calendar_events (title, description, event_date, event_time, location, is_all_day, created_by)
       VALUES ($1, $2, $3::DATE, $4, $5, $6, $7) 
       RETURNING 
         id,
         title,
         description,
         TO_CHAR(event_date, 'YYYY-MM-DD') as event_date,
         CASE WHEN event_time IS NOT NULL THEN TO_CHAR(event_time, 'HH24:MI') ELSE NULL END as event_time,
         location,
         is_all_day,
         created_by,
         created_at,
         updated_at`,
      [title, description || null, eventDate, eventTime || null, location || null, isAllDay, parseInt(req.user.id)]
    );

    res.status(201).json({
      message: 'Calendar event created successfully',
      event: result.rows[0]
    });
  } catch (error) {
    console.error('Create calendar event error:', error);
    console.error('Error details:', error instanceof Error ? error.message : error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
    });
  }
});

// Update calendar event (Admin only)
router.put('/:id', authenticateToken, [
  body('title').optional().notEmpty().trim(),
  body('eventDate').optional().isString(),
  body('description').optional().isString(),
  body('eventTime').optional().isString(),
  body('location').optional().isString(),
  body('isAllDay').optional().isBoolean(),
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

    // Validate date format if provided (YYYY-MM-DD)
    if (updateData.eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(updateData.eventDate)) {
      return res.status(400).json({ message: 'Invalid date format. Expected YYYY-MM-DD' });
    }

    // Validate and format time if provided (HH:MM or HH:MM:SS -> HH:MM)
    if (updateData.eventTime) {
      // Remove seconds if present (HH:MM:SS -> HH:MM)
      const timeStr = updateData.eventTime.split(':').slice(0, 2).join(':');
      if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeStr)) {
        return res.status(400).json({ message: 'Invalid time format. Expected HH:MM' });
      }
      updateData.eventTime = timeStr; // Store only HH:MM
    }

    // Check if event exists
    const existingEvent = await pool.query('SELECT * FROM calendar_events WHERE id = $1', [id]);

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
        const dbKey = key === 'eventDate' ? 'event_date' :
                     key === 'eventTime' ? 'event_time' :
                     key === 'isAllDay' ? 'is_all_day' : key;
        
        // Cast event_date to DATE type to avoid timezone issues
        if (key === 'eventDate') {
          updateFields.push(`${dbKey} = $${paramCount}::DATE`);
        } else {
          updateFields.push(`${dbKey} = $${paramCount}`);
        }
        values.push(updateData[key]);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE calendar_events 
       SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $${paramCount + 1} 
       RETURNING 
         id,
         title,
         description,
         TO_CHAR(event_date, 'YYYY-MM-DD') as event_date,
         CASE WHEN event_time IS NOT NULL THEN TO_CHAR(event_time, 'HH24:MI') ELSE NULL END as event_time,
         location,
         is_all_day,
         created_by,
         created_at,
         updated_at`,
      values
    );

    res.json({
      message: 'Calendar event updated successfully',
      event: result.rows[0]
    });
  } catch (error) {
    console.error('Update calendar event error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete calendar event (Admin only)
router.delete('/:id', authenticateToken, async (req: any, res: any) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;

    const event = await pool.query('SELECT id FROM calendar_events WHERE id = $1', [id]);

    if (event.rows.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }

    await pool.query('DELETE FROM calendar_events WHERE id = $1', [id]);

    res.json({ message: 'Calendar event deleted successfully' });
  } catch (error) {
    console.error('Delete calendar event error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;

