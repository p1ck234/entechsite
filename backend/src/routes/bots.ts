import express from 'express';
import { body, validationResult, query } from 'express-validator';
import { Pool } from 'pg';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://p1ck23@localhost:5432/entechsite',
});

// Get all bots
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
    const limit = parseInt(req.query.limit as string) || 100;
    const search = req.query.search as string;
    const skip = (page - 1) * limit;

    let whereClause = 'WHERE is_active = true';
    const params: any[] = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      whereClause += ` AND (name ILIKE $${paramCount} OR username ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    const [botsResult, totalResult] = await Promise.all([
      pool.query(
        `SELECT * FROM bots ${whereClause} ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
        [...params, limit, skip]
      ),
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
  } catch (error) {
    console.error('Get bots error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get bot by ID
router.get('/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM bots WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Bot not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get bot error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create bot (Admin only)
router.post('/', authenticateToken, requireAdmin, [
  body('name').notEmpty().withMessage('Name is required'),
  body('username').notEmpty().withMessage('Username is required'),
  body('description').optional().isString(),
  body('is_active').optional().isBoolean()
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, username, description, is_active = true } = req.body;
    
    // Убираем @ из username если есть
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;

    const result = await pool.query(
      `INSERT INTO bots (name, username, description, is_active) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [name, cleanUsername, description || null, is_active]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Create bot error:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ message: 'Bot with this username already exists' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update bot (Admin only)
router.put('/:id', authenticateToken, requireAdmin, [
  body('name').optional().notEmpty(),
  body('username').optional().notEmpty(),
  body('description').optional().isString(),
  body('is_active').optional().isBoolean()
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name, username, description, is_active } = req.body;

    // Проверяем существование бота
    const existingBot = await pool.query('SELECT * FROM bots WHERE id = $1', [id]);
    if (existingBot.rows.length === 0) {
      return res.status(404).json({ message: 'Bot not found' });
    }

    // Формируем запрос для обновления
    const updates: string[] = [];
    const values: any[] = [];
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

    const result = await pool.query(
      `UPDATE bots SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Update bot error:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ message: 'Bot with this username already exists' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete bot (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM bots WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Bot not found' });
    }
    
    res.json({ message: 'Bot deleted successfully' });
  } catch (error) {
    console.error('Delete bot error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;

