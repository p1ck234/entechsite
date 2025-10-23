import express from 'express';
import { body, validationResult, query } from 'express-validator';
import { Pool } from 'pg';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Get all courses
router.get('/', authenticateToken, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString()
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const skip = (page - 1) * limit;

    let whereClause = 'WHERE is_active = true';
    const params: any[] = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      whereClause += ` AND (title ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    const [coursesResult, totalResult] = await Promise.all([
      pool.query(
        `SELECT * FROM courses ${whereClause} ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
        [...params, limit, skip]
      ),
      pool.query(`SELECT COUNT(*) FROM courses ${whereClause}`, params)
    ]);

    const courses = coursesResult.rows;
    const total = parseInt(totalResult.rows[0].count);

    // Get user progress for each course
    const coursesWithProgress = await Promise.all(
      courses.map(async (course: any) => {
        const progressResult = await pool.query(
          'SELECT progress, completed FROM course_progress WHERE user_id = $1 AND course_id = $2',
          [req.user.id, course.id]
        );
        
        return {
          ...course,
          userProgress: progressResult.rows[0] || { progress: 0, completed: false }
        };
      })
    );

    res.json({
      courses: coursesWithProgress,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get course by ID
router.get('/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const courseResult = await pool.query('SELECT * FROM courses WHERE id = $1', [id]);

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const course = courseResult.rows[0];

    // Get user progress
    const progressResult = await pool.query(
      'SELECT progress, completed, started_at, completed_at FROM course_progress WHERE user_id = $1 AND course_id = $2',
      [req.user.id, id]
    );

    const courseWithProgress = {
      ...course,
      userProgress: progressResult.rows[0] || { progress: 0, completed: false, started_at: null, completed_at: null }
    };

    res.json(courseWithProgress);
  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create course (Admin only)
router.post('/', authenticateToken, [
  body('title').notEmpty().trim(),
  body('description').optional().isString(),
  body('googleDriveUrl').isURL(),
  body('duration').optional().isInt({ min: 1 })
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { title, description, googleDriveUrl, duration } = req.body;

    const result = await pool.query(
      'INSERT INTO courses (title, description, google_drive_url, duration) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, description, googleDriveUrl, duration]
    );

    res.status(201).json({
      message: 'Course created successfully',
      course: result.rows[0]
    });
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update course (Admin only)
router.put('/:id', authenticateToken, [
  body('title').optional().notEmpty().trim(),
  body('description').optional().isString(),
  body('googleDriveUrl').optional().isURL(),
  body('duration').optional().isInt({ min: 1 }),
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

    const course = await pool.query('SELECT id FROM courses WHERE id = $1', [id]);

    if (course.rows.length === 0) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const values: any[] = [];
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
    const result = await pool.query(
      `UPDATE courses SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount + 1} RETURNING *`,
      values
    );

    res.json({
      message: 'Course updated successfully',
      course: result.rows[0]
    });
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete course (Admin only)
router.delete('/:id', authenticateToken, async (req: any, res: any) => {
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
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update course progress
router.post('/:id/progress', authenticateToken, [
  body('progress').isInt({ min: 0, max: 100 }),
  body('completed').optional().isBoolean()
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { progress, completed = false } = req.body;
    const userId = req.user.id;

    // Check if course exists
    const course = await pool.query('SELECT id FROM courses WHERE id = $1', [id]);

    if (course.rows.length === 0) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Upsert progress
    const result = await pool.query(
      `INSERT INTO course_progress (user_id, course_id, progress, completed, completed_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, course_id)
       DO UPDATE SET progress = $3, completed = $4, completed_at = $5
       RETURNING *`,
      [userId, id, progress, completed, completed ? new Date() : null]
    );

    res.json({
      message: 'Progress updated successfully',
      progress: result.rows[0]
    });
  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get user's course progress
router.get('/progress/user', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const result = await pool.query(
      `SELECT cp.*, c.title, c.description, c.duration, c.google_drive_url
       FROM course_progress cp
       JOIN courses c ON cp.course_id = c.id
       WHERE cp.user_id = $1
       ORDER BY cp.updated_at DESC`,
      [userId]
    );

    res.json({ progress: result.rows });
  } catch (error) {
    console.error('Get user progress error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;