import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { randomUUID } from 'crypto';
import { pool } from '../db/pool';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import {
  combineDateAndTime,
  expandRecurrenceDates,
  formatDateOnly,
  formatTimeFromDate,
  normalizeWeekdays,
  validateBookingWindow,
  validateRecurrenceInput,
  type BookingRecurrenceInput,
} from '../utils/booking-rules';
import { assertCanManageBooking } from '../utils/booking-permissions';

const router = express.Router();

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
  date: formatDateOnly(row.starts_at),
  startTime: formatTimeFromDate(row.starts_at),
  endTime: formatTimeFromDate(row.ends_at),
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  status: row.status,
  recurrenceGroupId: row.recurrence_group_id ? String(row.recurrence_group_id) : undefined,
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
    query('fromDate').optional().isISO8601({ strict: true }),
    query('toDate').optional().isISO8601({ strict: true }),
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

      if (req.query.fromDate && req.query.toDate) {
        params.push(String(req.query.fromDate));
        params.push(String(req.query.toDate));
        conditions.push(`DATE(b.starts_at) >= $${params.length - 1}::date`);
        conditions.push(`DATE(b.starts_at) <= $${params.length}::date`);
      } else if (req.query.date) {
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
    body('recurrence.type').optional().isIn(['none', 'weekly']),
    body('recurrence.weekdays').optional().isArray({ min: 1, max: 7 }),
    body('recurrence.weekdays.*').optional().isInt({ min: 0, max: 6 }),
    body('recurrence.untilDate').optional().isISO8601({ strict: true }),
  ],
  async (req: AuthRequest, res: any) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { resourceId, title, description, date, startTime, endTime } = req.body;
      const recurrence: BookingRecurrenceInput = {
        type: req.body.recurrence?.type || 'none',
        weekdays: normalizeWeekdays(req.body.recurrence?.weekdays),
        untilDate: req.body.recurrence?.untilDate,
      };

      const recurrenceError = validateRecurrenceInput(recurrence, date);
      if (recurrenceError) {
        return res.status(400).json({ message: recurrenceError });
      }

      const occurrenceDates = expandRecurrenceDates(date, recurrence);

      if (occurrenceDates.length === 0) {
        return res.status(400).json({ message: 'Не удалось построить серию повторений' });
      }

      const resource = await pool.query(
        'SELECT id, name, type, is_active FROM booking_resources WHERE id = $1',
        [resourceId]
      );

      if (resource.rows.length === 0 || !resource.rows[0].is_active) {
        return res.status(404).json({ message: 'Ресурс не найден или недоступен' });
      }

      const plannedBookings: Array<{ startsAt: Date; endsAt: Date; date: string }> = [];
      for (const occurrenceDate of occurrenceDates) {
        const startsAt = combineDateAndTime(occurrenceDate, startTime);
        const endsAt = combineDateAndTime(occurrenceDate, endTime);
        const validationError = validateBookingWindow(startsAt, endsAt);

        if (validationError) {
          return res.status(400).json({
            message: `${formatDateOnly(occurrenceDate)}: ${validationError}`,
          });
        }

        plannedBookings.push({ startsAt, endsAt, date: occurrenceDate });
      }

      const conflictDates: string[] = [];
      for (const planned of plannedBookings) {
        const conflict = await hasBookingConflict(String(resourceId), planned.startsAt, planned.endsAt);
        if (conflict) {
          conflictDates.push(planned.date);
        }
      }

      if (conflictDates.length > 0) {
        return res.status(409).json({
          message:
            conflictDates.length === 1
              ? `Слот занят: ${conflictDates[0]}`
              : `Некоторые слоты уже заняты: ${conflictDates.join(', ')}`,
          conflictDates,
        });
      }

      const recurrenceGroupId = recurrence.type === 'none' ? null : randomUUID();
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const createdIds: number[] = [];
        for (const planned of plannedBookings) {
          const created = await client.query(
            `INSERT INTO bookings (resource_id, user_id, title, description, starts_at, ends_at, status, recurrence_group_id)
             VALUES ($1, $2, $3, $4, $5, $6, 'confirmed', $7)
             RETURNING id`,
            [
              resourceId,
              req.user!.id,
              title,
              description || null,
              planned.startsAt,
              planned.endsAt,
              recurrenceGroupId,
            ]
          );
          createdIds.push(created.rows[0].id);
        }

        await client.query('COMMIT');

        const result = await pool.query(`${bookingSelect} WHERE b.id = $1`, [createdIds[0]]);

        res.status(201).json({
          message:
            createdIds.length > 1
              ? `Создано повторяющихся бронирований: ${createdIds.length}`
              : 'Бронирование создано',
          booking: mapBooking(result.rows[0]),
          createdCount: createdIds.length,
          bookingIds: createdIds.map(String),
        });
      } catch (transactionError) {
        await client.query('ROLLBACK');
        throw transactionError;
      } finally {
        client.release();
      }
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
      const permissionError = assertCanManageBooking(req.user, booking.user_id);

      if (permissionError) {
        return res.status(403).json({ message: permissionError });
      }

      if (booking.status !== 'confirmed') {
        return res.status(400).json({ message: 'Нельзя изменить отменённое бронирование' });
      }

      const currentStart = new Date(booking.starts_at);
      const date = req.body.date || formatDateOnly(currentStart);
      const startTime = req.body.startTime || formatTimeFromDate(currentStart);
      const endTime = req.body.endTime || formatTimeFromDate(new Date(booking.ends_at));

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

router.delete('/:id', authenticateToken, [
  query('scope').optional().isIn(['single', 'series']),
], async (req: AuthRequest, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const scope = req.query.scope === 'series' ? 'series' : 'single';
    const existing = await pool.query('SELECT * FROM bookings WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Бронирование не найдено' });
    }

    const booking = existing.rows[0];
    const permissionError = assertCanManageBooking(req.user, booking.user_id);

    if (permissionError) {
      return res.status(403).json({ message: permissionError });
    }

    if (scope === 'series' && booking.recurrence_group_id) {
      const isAdmin = req.user!.role === 'ADMIN';
      const cancelled = await pool.query(
        `UPDATE bookings
         SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
         WHERE recurrence_group_id = $1
           AND status = 'confirmed'
           ${isAdmin ? '' : 'AND user_id = $2'}
         RETURNING id`,
        isAdmin ? [booking.recurrence_group_id] : [booking.recurrence_group_id, req.user!.id]
      );

      return res.json({
        message: `Отменено бронирований: ${cancelled.rowCount || 0}`,
        cancelledCount: cancelled.rowCount || 0,
      });
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
