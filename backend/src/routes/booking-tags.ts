import express from 'express';
import { body, validationResult } from 'express-validator';
import { Pool } from 'pg';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://p1ck23@localhost:5432/entechsite',
});

const mapTag = (row: any) => ({
  id: String(row.id),
  name: row.name,
  createdAt: row.created_at,
});

router.get('/', authenticateToken, async (_req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, created_at
       FROM booking_tags
       ORDER BY name ASC`
    );

    res.json({ tags: result.rows.map(mapTag) });
  } catch (error) {
    console.error('Get booking tags error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post(
  '/',
  authenticateToken,
  requireAdmin,
  [body('name').trim().notEmpty().isLength({ max: 50 })],
  async (req: AuthRequest, res: any) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const name = String(req.body.name).trim().toUpperCase();

      const existing = await pool.query('SELECT id, name, created_at FROM booking_tags WHERE name = $1', [name]);
      if (existing.rows.length > 0) {
        return res.status(200).json({
          message: 'Тег уже существует',
          tag: mapTag(existing.rows[0]),
        });
      }

      const created = await pool.query(
        `INSERT INTO booking_tags (name)
         VALUES ($1)
         RETURNING id, name, created_at`,
        [name]
      );

      res.status(201).json({
        message: 'Тег создан',
        tag: mapTag(created.rows[0]),
      });
    } catch (error) {
      console.error('Create booking tag error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

export default router;
