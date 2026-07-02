import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { Pool } from 'pg';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { combineDateAndTime, validateBookingWindow } from '../utils/booking-rules';

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://p1ck23@localhost:5432/entechsite',
});

const mapBooking = (row: any) => ({
  id: String(row.id),
  resourceId: String(row.resource_id),
  resourceName: row.resource_name,
  resourceType: row.resource_type,
  zoomUrl: row.zoom_url || undefined,
  userId: String(row.user_id),
  userEmail: row.user_email,
  employeeName: row.employee_name || undefined,
  title: row.title,
  description: row.description || undefined,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const bookingSelect = `
  SELECT
    b.*,
    r.name AS resource_name,
    r.type AS resource_type,
    r.zoom_url,
    u.email AS user_email,
    NULLIF(TRIM(CONCAT(e.last_name, ' ', e.first_name)), '') AS employee_name
  FROM bookings b
  JOIN booking_resources r ON r.id = b.resource_id
  JOIN users u ON u.id = b.user_id
  LEFT JOIN employees e ON e.email = u.email
`;

const hasBookingConflict = async (
  resourceId: string,
  startsAt: Date,
  endsAt: Date,
  excludeBookingId?: string
): Promise<boolean> => {
  const params: Array<string | Date> = [resourceId, endsAt, startsAt];
  let excludeClause = '';

  if (excludeBookingId) {
    params.push(excludeBookingId);
    excludeClause = `AND b.id <> $${params.length}`;
  }

  const result = await pool.query(
    `SELECT id
     FROM bookings b
     WHERE b.resource_id = $1
       AND b.status = 'confirmed'
       AND b.starts_at < $2
       AND b.ends_at > $3
       ${excludeClause}
     LIMIT 1`,
    params
  );

  return result.rows.length > 0;
};

router.get(
  '/',
  authenticateToken,
  [
    query('date').optional().isISO8601({ strict: true }),
    query('type').optional().isIn(['room', 'zoom']),
    query('resourceId').optional().isInt({ min: 1 }),
    query('mine').optional().isBoolean(),
  ],
  async (req: AuthRequest, res: any) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const conditions: string[] = [`b.status = 'confirmed'`];
      const params: Array<string | number> = [];

      if (req.query.date) {
        params.push(String(req.query.date));
        conditions.push(`DATE(b.starts_at) = $${params.length}::date`);
      }

      if (req.query.type) {
        params.push(String(req.query.type));
        conditions.push(`r.type = $${params.length}`);
      }

      if (req.query.resourceId) {
        params.push(Number(req.query.resourceId));
        conditions.push(`b.resource_id = $${params.length}`);
      }

      if (req.query.mine === 'true') {
        params.push(Number(req.user!.id));
        conditions.push(`b.user_id = $${params.length}`);
      }

      const result = await pool.query(
        `${bookingSelect}
         WHERE ${conditions.join(' AND ')}
         ORDER BY b.starts_at ASC`,
        params
      );

      res.json({ bookings: result.rows.map(mapBooking) });
    } catch (error) {
      console.error('Get bookings error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

router.post(
  '/',
  authenticateToken,
  [
    body('resourceId').isInt({ min: 1 }),
    body('title').trim().notEmpty(),
    body('description').optional().isString(),
    body('date').isISO8601({ strict: true }),
    body('startTime').matches(/^\d{2}:\d{2}$/),
    body('endTime').matches(/^\d{2}:\d{2}$/),
  ],
  async (req: AuthRequest, res: any) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { resourceId, title, description, date, startTime, endTime } = req.body;
      const startsAt = combineDateAndTime(date, startTime);
      const endsAt = combineDateAndTime(date, endTime);

      const validationError = validateBookingWindow(startsAt, endsAt);
      if (validationError) {
        return res.status(400).json({ message: validationError });
      }

      const resource = await pool.query(
        'SELECT id, name, type, is_active FROM booking_resources WHERE id = $1',
        [resourceId]
      );

      if (resource.rows.length === 0 || !resource.rows[0].is_active) {
        return res.status(404).json({ message: 'Ресурс не найден или недоступен' });
      }

      const conflict = await hasBookingConflict(String(resourceId), startsAt, endsAt);
      if (conflict) {
        return res.status(409).json({
          message: 'Этот слот уже занят. Выберите другое время или ресурс.',
        });
      }

      const created = await pool.query(
        `INSERT INTO bookings (resource_id, user_id, title, description, starts_at, ends_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'confirmed')
         RETURNING id`,
        [resourceId, req.user!.id, title, description || null, startsAt, endsAt]
      );

      const result = await pool.query(`${bookingSelect} WHERE b.id = $1`, [created.rows[0].id]);

      res.status(201).json({
        message: 'Бронирование создано',
        booking: mapBooking(result.rows[0]),
      });
    } catch (error) {
      console.error('Create booking error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

router.put(
  '/:id',
  authenticateToken,
  [
    body('title').optional().trim().notEmpty(),
    body('description').optional().isString(),
    body('date').optional().isISO8601({ strict: true }),
    body('startTime').optional().matches(/^\d{2}:\d{2}$/),
    body('endTime').optional().matches(/^\d{2}:\d{2}$/),
  ],
  async (req: AuthRequest, res: any) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const existing = await pool.query('SELECT * FROM bookings WHERE id = $1', [id]);

      if (existing.rows.length === 0) {
        return res.status(404).json({ message: 'Бронирование не найдено' });
      }

      const booking = existing.rows[0];
      const isOwner = String(booking.user_id) === req.user!.id;
      const isAdmin = req.user!.role === 'ADMIN';

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: 'Можно редактировать только свои бронирования' });
      }

      if (booking.status !== 'confirmed') {
        return res.status(400).json({ message: 'Нельзя изменить отменённое бронирование' });
      }

      const currentStart = new Date(booking.starts_at);
      const currentEnd = new Date(booking.ends_at);
      const date = req.body.date || currentStart.toISOString().slice(0, 10);
      const startTime =
        req.body.startTime ||
        `${String(currentStart.getHours()).padStart(2, '0')}:${String(currentStart.getMinutes()).padStart(2, '0')}`;
      const endTime =
        req.body.endTime ||
        `${String(currentEnd.getHours()).padStart(2, '0')}:${String(currentEnd.getMinutes()).padStart(2, '0')}`;

      const startsAt = combineDateAndTime(date, startTime);
      const endsAt = combineDateAndTime(date, endTime);
      const validationError = validateBookingWindow(startsAt, endsAt);

      if (validationError) {
        return res.status(400).json({ message: validationError });
      }

      const conflict = await hasBookingConflict(String(booking.resource_id), startsAt, endsAt, id);
      if (conflict) {
        return res.status(409).json({
          message: 'Этот слот уже занят. Выберите другое время или ресурс.',
        });
      }

      await pool.query(
        `UPDATE bookings
         SET title = COALESCE($1, title),
             description = COALESCE($2, description),
             starts_at = $3,
             ends_at = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [req.body.title ?? null, req.body.description ?? null, startsAt, endsAt, id]
      );

      const result = await pool.query(`${bookingSelect} WHERE b.id = $1`, [id]);

      res.json({
        message: 'Бронирование обновлено',
        booking: mapBooking(result.rows[0]),
      });
    } catch (error) {
      console.error('Update booking error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

router.delete('/:id', authenticateToken, async (req: AuthRequest, res: any) => {
  try {
    const { id } = req.params;
    const existing = await pool.query('SELECT * FROM bookings WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Бронирование не найдено' });
    }

    const booking = existing.rows[0];
    const isOwner = String(booking.user_id) === req.user!.id;
    const isAdmin = req.user!.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Можно отменять только свои бронирования' });
    }

    await pool.query(
      `UPDATE bookings
       SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    res.json({ message: 'Бронирование отменено' });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
