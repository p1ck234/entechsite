import express from 'express';
import { body, validationResult } from 'express-validator';
import { Pool } from 'pg';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://p1ck23@localhost:5432/entechsite',
});

const mapResource = (row: any) => ({
  id: String(row.id),
  name: row.name,
  type: row.type,
  zoomUrl: row.zoom_url || undefined,
  description: row.description || undefined,
  isActive: row.is_active,
  sortOrder: row.sort_order,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

router.get('/', authenticateToken, async (_req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM booking_resources
       WHERE is_active = true
       ORDER BY type ASC, sort_order ASC, name ASC`
    );

    res.json({ resources: result.rows.map(mapResource) });
  } catch (error) {
    console.error('Get booking resources error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/all', authenticateToken, requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM booking_resources
       ORDER BY type ASC, sort_order ASC, name ASC`
    );

    res.json({ resources: result.rows.map(mapResource) });
  } catch (error) {
    console.error('Get all booking resources error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post(
  '/',
  authenticateToken,
  requireAdmin,
  [
    body('name').trim().notEmpty(),
    body('type').isIn(['room', 'zoom']),
    body('zoomUrl').optional({ values: 'null' }).isURL(),
    body('description').optional().isString(),
    body('sortOrder').optional().isInt({ min: 0 }),
  ],
  async (req: AuthRequest, res: any) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, type, zoomUrl, description, sortOrder = 0 } = req.body;

      const result = await pool.query(
        `INSERT INTO booking_resources (name, type, zoom_url, description, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [name, type, zoomUrl || null, description || null, sortOrder]
      );

      res.status(201).json({
        message: 'Ресурс создан',
        resource: mapResource(result.rows[0]),
      });
    } catch (error) {
      console.error('Create booking resource error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  [
    body('name').optional().trim().notEmpty(),
    body('type').optional().isIn(['room', 'zoom']),
    body('zoomUrl').optional({ values: 'null' }),
    body('description').optional().isString(),
    body('sortOrder').optional().isInt({ min: 0 }),
    body('isActive').optional().isBoolean(),
  ],
  async (req: AuthRequest, res: any) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const existing = await pool.query('SELECT * FROM booking_resources WHERE id = $1', [id]);

      if (existing.rows.length === 0) {
        return res.status(404).json({ message: 'Ресурс не найден' });
      }

      const current = existing.rows[0];
      const nextType = req.body.type ?? current.type;
      const nextZoomUrl = req.body.zoomUrl === undefined ? current.zoom_url : req.body.zoomUrl;

      const result = await pool.query(
        `UPDATE booking_resources
         SET name = COALESCE($1, name),
             type = COALESCE($2, type),
             zoom_url = $3,
             description = COALESCE($4, description),
             sort_order = COALESCE($5, sort_order),
             is_active = COALESCE($6, is_active),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $7
         RETURNING *`,
        [
          req.body.name ?? null,
          req.body.type ?? null,
          nextZoomUrl,
          req.body.description ?? null,
          req.body.sortOrder ?? null,
          req.body.isActive ?? null,
          id,
        ]
      );

      res.json({
        message: 'Ресурс обновлён',
        resource: mapResource(result.rows[0]),
      });
    } catch (error) {
      console.error('Update booking resource error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: any) => {
  try {
    const { id } = req.params;

    const existing = await pool.query('SELECT id FROM booking_resources WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Ресурс не найден' });
    }

    await pool.query(
      `UPDATE booking_resources
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    res.json({ message: 'Ресурс скрыт' });
  } catch (error) {
    console.error('Delete booking resource error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
