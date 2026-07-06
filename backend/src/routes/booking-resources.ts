import express from 'express';
import { body, validationResult } from 'express-validator';
import { pool } from '../db/pool';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { ensureBookingResourcesSchema } from '../utils/ensure-schema';
import {
  RESOURCE_WITH_TAGS_SELECT,
  normalizeTagIds,
  parseResourceTags,
  syncResourceTags,
} from '../utils/booking-tags';

const router = express.Router();

router.use(async (_req, _res, next) => {
  try {
    await ensureBookingResourcesSchema(pool);
    next();
  } catch (error) {
    console.error('Booking resources schema ensure error:', error);
    next(error);
  }
});

const releaseClient = async (client: any) => {
  if (client) {
    try {
      client.release();
    } catch {
      // пул уже мог закрыть соединение
    }
  }
};

const mapResource = (row: any) => ({
  id: String(row.id),
  name: row.name,
  type: row.type,
  zoomUrl: row.zoom_url || undefined,
  description: row.description || undefined,
  isActive: row.is_active,
  sortOrder: row.sort_order,
  tags: parseResourceTags(row.tags),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const loadResourceById = async (id: string | number) => {
  try {
    const result = await pool.query(
      `${RESOURCE_WITH_TAGS_SELECT}
       WHERE r.id = $1
       GROUP BY r.id`,
      [id]
    );

    return result.rows[0] ? mapResource(result.rows[0]) : null;
  } catch (error) {
    console.error('Load resource with tags error, fallback:', error);
    const result = await pool.query('SELECT * FROM booking_resources WHERE id = $1', [id]);
    return result.rows[0] ? mapResource({ ...result.rows[0], tags: [] }) : null;
  }
};

const loadActiveResources = async () => {
  try {
    const result = await pool.query(
      `${RESOURCE_WITH_TAGS_SELECT}
       WHERE r.is_active = true
       GROUP BY r.id
       ORDER BY r.type ASC, r.sort_order ASC, r.name ASC`
    );

    return result.rows.map(mapResource);
  } catch (error) {
    console.error('Get booking resources with tags error, fallback to plain select:', error);
    const result = await pool.query(
      `SELECT *
       FROM booking_resources
       WHERE is_active = true
       ORDER BY type ASC, sort_order ASC, name ASC`
    );

    return result.rows.map((row) => mapResource({ ...row, tags: [] }));
  }
};

router.get('/', authenticateToken, async (_req: AuthRequest, res) => {
  try {
    res.json({ resources: await loadActiveResources() });
  } catch (error) {
    console.error('Get booking resources error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/all', authenticateToken, requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `${RESOURCE_WITH_TAGS_SELECT}
       GROUP BY r.id
       ORDER BY r.type ASC, r.sort_order ASC, r.name ASC`
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
    body('zoomUrl').optional({ values: 'falsy' }).isURL({ require_protocol: true }),
    body('description').optional().isString(),
    body('sortOrder').optional().isInt({ min: 0 }),
    body('tagIds').optional().isArray(),
    body('tagIds.*').optional().isInt({ min: 1 }),
  ],
  async (req: AuthRequest, res: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: errors.array()[0]?.msg || 'Ошибка валидации',
        errors: errors.array(),
      });
    }

    let client;

    try {
      client = await pool.connect();

      const { name, type, zoomUrl, description, sortOrder = 0 } = req.body;
      const tagIds = normalizeTagIds(req.body.tagIds);

      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO booking_resources (name, type, zoom_url, description, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [name, type, zoomUrl || null, description || null, sortOrder]
      );

      const resourceId = result.rows[0].id;
      try {
        await syncResourceTags(client, resourceId, tagIds);
      } catch (tagError) {
        console.error('Sync resource tags error (ignored):', tagError);
      }
      await client.query('COMMIT');

      const resource = await loadResourceById(resourceId);

      res.status(201).json({
        message: 'Ресурс создан',
        resource,
      });
    } catch (error) {
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // транзакция могла не начаться
        }
      }
      console.error('Create booking resource error:', error);
      res.status(500).json({ message: 'Internal server error' });
    } finally {
      await releaseClient(client);
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
    body('zoomUrl').optional({ values: 'falsy' }).isURL({ require_protocol: true }),
    body('description').optional().isString(),
    body('sortOrder').optional().isInt({ min: 0 }),
    body('isActive').optional().isBoolean(),
    body('tagIds').optional().isArray(),
    body('tagIds.*').optional().isInt({ min: 1 }),
  ],
  async (req: AuthRequest, res: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: errors.array()[0]?.msg || 'Ошибка валидации',
        errors: errors.array(),
      });
    }

    let client;

    try {
      client = await pool.connect();

      const { id } = req.params;
      const existing = await client.query('SELECT * FROM booking_resources WHERE id = $1', [id]);

      if (existing.rows.length === 0) {
        return res.status(404).json({ message: 'Ресурс не найден' });
      }

      const current = existing.rows[0];
      const nextType = req.body.type ?? current.type;
      const nextZoomUrl = req.body.zoomUrl === undefined ? current.zoom_url : req.body.zoomUrl;

      await client.query('BEGIN');

      await client.query(
        `UPDATE booking_resources
         SET name = COALESCE($1, name),
             type = COALESCE($2, type),
             zoom_url = $3,
             description = COALESCE($4, description),
             sort_order = COALESCE($5, sort_order),
             is_active = COALESCE($6, is_active),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $7`,
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

      if (req.body.tagIds !== undefined) {
        try {
          await syncResourceTags(client, id, normalizeTagIds(req.body.tagIds));
        } catch (tagError) {
          console.error('Sync resource tags error (ignored):', tagError);
        }
      }

      await client.query('COMMIT');

      const resource = await loadResourceById(id);

      res.json({
        message: 'Ресурс обновлён',
        resource,
      });
    } catch (error) {
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // транзакция могла не начаться
        }
      }
      console.error('Update booking resource error:', error);
      res.status(500).json({ message: 'Internal server error' });
    } finally {
      await releaseClient(client);
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
  } catch (error: any) {
    console.error('Delete booking resource error:', error);
    const detail = error?.message ? String(error.message) : 'Internal server error';
    res.status(500).json({
      message: process.env.NODE_ENV === 'development' ? detail : 'Не удалось скрыть ресурс',
    });
  }
});

export default router;
