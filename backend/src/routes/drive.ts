import express from 'express';
import { Pool } from 'pg';
import { authenticateToken } from '../middleware/auth';
import { DriveCourseFolder, DriveFileItem, getLifeDriveItems, getTrainingDriveTree } from '../services/googleDrive';

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://p1ck23@localhost:5432/entechsite',
});

interface SyncStats {
  coursesCreated: number;
  coursesUpdated: number;
  coursesUnchanged: number;
  lessonsCreated: number;
  lessonsUpdated: number;
  lessonsUnchanged: number;
  lessonsArchived: number;
}

interface LifeSyncStats {
  eventsFound: number;
  eventsCreated: number;
  eventsUpdated: number;
  eventsUnchanged: number;
  eventsArchived: number;
  eventsSkippedNoDate: number;
}

const DRIVE_LIFE_DESCRIPTION = 'Синхронизировано из Google Drive';

const getUniqueUrls = (...urls: Array<string | undefined>): string[] => {
  return Array.from(new Set(urls.filter(Boolean) as string[]));
};

const getDriveFolderUrl = (folderId: string): string => {
  return `https://drive.google.com/drive/folders/${folderId}`;
};

const getDriveFileUrl = (fileId: string): string => {
  return `https://drive.google.com/file/d/${fileId}/view`;
};

const isDriveFolder = (item: DriveFileItem): boolean => {
  return item.mimeType === 'application/vnd.google-apps.folder';
};

const getLessonUrl = (lesson: DriveFileItem): string => {
  return isDriveFolder(lesson) ? getDriveFolderUrl(lesson.id) : getDriveFileUrl(lesson.id);
};

const getLessonDescription = (lesson: DriveFileItem): string | null => {
  return isDriveFolder(lesson) ? 'Папка Google Drive' : lesson.mimeType || 'Файл Google Drive';
};

const parseDriveLifeTitle = (name: string): { title: string; eventDate: string | null } => {
  const datePatterns = [
    /(?<day>\d{1,2})[./-](?<month>\d{1,2})[./-](?<year>\d{4})/,
    /(?<year>\d{4})[./-](?<month>\d{1,2})[./-](?<day>\d{1,2})/,
  ];

  for (const pattern of datePatterns) {
    const match = name.match(pattern);

    if (!match?.groups) {
      continue;
    }

    const day = match.groups.day.padStart(2, '0');
    const month = match.groups.month.padStart(2, '0');
    const year = match.groups.year;
    const parsedDate = new Date(`${year}-${month}-${day}T00:00:00.000Z`);

    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.getUTCFullYear() !== Number(year) ||
      parsedDate.getUTCMonth() + 1 !== Number(month) ||
      parsedDate.getUTCDate() !== Number(day)
    ) {
      continue;
    }

    const title = name
      .replace(match[0], '')
      .replace(/\s*[—–-]\s*/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    return {
      title: title || name,
      eventDate: `${year}-${month}-${day}`,
    };
  }

  return { title: name.trim(), eventDate: null };
};

const upsertCourse = async (client: any, courseFolder: DriveCourseFolder, stats: SyncStats): Promise<number> => {
  const courseUrl = getDriveFolderUrl(courseFolder.id);
  const courseUrlCandidates = getUniqueUrls(courseUrl, courseFolder.webViewLink);
  const existingCourse = await client.query(
    'SELECT id, title, google_drive_url, is_active FROM courses WHERE google_drive_url = ANY($1::text[]) LIMIT 1',
    [courseUrlCandidates]
  );

  if (existingCourse.rows.length > 0) {
    const existing = existingCourse.rows[0];
    const courseId = existing.id;

    if (existing.title === courseFolder.name && existing.google_drive_url === courseUrl && existing.is_active === true) {
      stats.coursesUnchanged += 1;
      return courseId;
    }

    await client.query(
      `UPDATE courses
       SET title = $1, google_drive_url = $2, is_active = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [courseFolder.name, courseUrl, courseId]
    );
    stats.coursesUpdated += 1;
    return courseId;
  }

  const createdCourse = await client.query(
    `INSERT INTO courses (title, description, google_drive_url, duration, is_active)
     VALUES ($1, $2, $3, $4, true)
     RETURNING id`,
    [courseFolder.name, 'Синхронизировано из Google Drive', courseUrl, null]
  );

  stats.coursesCreated += 1;
  return createdCourse.rows[0].id;
};

const upsertLessons = async (client: any, courseId: number, courseFolder: DriveCourseFolder, stats: SyncStats): Promise<void> => {
  const activeLessonUrls: string[] = [];

  for (const [index, lesson] of courseFolder.lessons.entries()) {
    const lessonUrl = getLessonUrl(lesson);
    const lessonDescription = getLessonDescription(lesson);
    const lessonUrlCandidates = getUniqueUrls(lessonUrl, lesson.webViewLink);
    activeLessonUrls.push(lessonUrl);
    const existingLesson = await client.query(
      `SELECT id, title, description, google_drive_url, order_index, is_active
       FROM lessons
       WHERE course_id = $1 AND google_drive_url = ANY($2::text[])
       LIMIT 1`,
      [courseId, lessonUrlCandidates]
    );

    if (existingLesson.rows.length > 0) {
      const existing = existingLesson.rows[0];
      const unchanged =
        existing.title === lesson.name &&
        (existing.description || null) === lessonDescription &&
        existing.google_drive_url === lessonUrl &&
        Number(existing.order_index) === index &&
        existing.is_active === true;

      if (unchanged) {
        stats.lessonsUnchanged += 1;
        continue;
      }

      await client.query(
        `UPDATE lessons
         SET title = $1, description = $2, google_drive_url = $3, order_index = $4, is_active = true, updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [lesson.name, lessonDescription, lessonUrl, index, existing.id]
      );
      stats.lessonsUpdated += 1;
      continue;
    }

    await client.query(
      `INSERT INTO lessons (course_id, title, description, google_drive_url, duration, order_index, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)`,
      [courseId, lesson.name, lessonDescription, lessonUrl, null, index]
    );
    stats.lessonsCreated += 1;
  }

  const archivedLessons = await client.query(
    `UPDATE lessons
     SET is_active = false, updated_at = CURRENT_TIMESTAMP
     WHERE course_id = $1
       AND is_active = true
       AND NOT (google_drive_url = ANY($2::text[]))`,
    [courseId, activeLessonUrls]
  );
  stats.lessonsArchived += archivedLessons.rowCount || 0;
};

router.post('/sync-training', authenticateToken, async (req: any, res: any) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Admin access required' });
  }

  const client = await pool.connect();
  const stats: SyncStats = {
    coursesCreated: 0,
    coursesUpdated: 0,
    coursesUnchanged: 0,
    lessonsCreated: 0,
    lessonsUpdated: 0,
    lessonsUnchanged: 0,
    lessonsArchived: 0,
  };

  try {
    const driveTree = await getTrainingDriveTree();

    await client.query('BEGIN');
    for (const courseFolder of driveTree.courses) {
      const courseId = await upsertCourse(client, courseFolder, stats);
      await upsertLessons(client, courseId, courseFolder, stats);
    }
    await client.query('COMMIT');

    res.json({
      message: 'Обучение синхронизировано из Google Drive',
      root: driveTree.root,
      coursesFound: driveTree.courses.length,
      ...stats,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Google Drive training sync error:', error);
    res.status(500).json({
      message: error?.message || 'Ошибка синхронизации Google Drive',
    });
  } finally {
    client.release();
  }
});

router.post('/sync-life', authenticateToken, async (req: any, res: any) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Admin access required' });
  }

  const client = await pool.connect();
  const stats: LifeSyncStats = {
    eventsFound: 0,
    eventsCreated: 0,
    eventsUpdated: 0,
    eventsUnchanged: 0,
    eventsArchived: 0,
    eventsSkippedNoDate: 0,
  };
  const activeEventUrls: string[] = [];

  try {
    const driveLife = await getLifeDriveItems();
    stats.eventsFound = driveLife.items.length;

    await client.query('BEGIN');

    for (const item of driveLife.items) {
      const eventUrl = item.webViewLink || (isDriveFolder(item) ? getDriveFolderUrl(item.id) : getDriveFileUrl(item.id));
      const eventUrlCandidates = getUniqueUrls(eventUrl, item.webViewLink);
      const { title, eventDate } = parseDriveLifeTitle(item.name);

      if (!eventDate) {
        stats.eventsSkippedNoDate += 1;
        continue;
      }

      activeEventUrls.push(eventUrl);
      const existingEvent = await client.query(
        `SELECT id, title, description, google_drive_url, event_date, is_active
         FROM events
         WHERE google_drive_url = ANY($1::text[])
         LIMIT 1`,
        [eventUrlCandidates]
      );

      if (existingEvent.rows.length > 0) {
        const existing = existingEvent.rows[0];
        const existingDate = existing.event_date ? new Date(existing.event_date).toISOString().slice(0, 10) : null;
        const unchanged =
          existing.title === title &&
          (existing.description || null) === DRIVE_LIFE_DESCRIPTION &&
          existing.google_drive_url === eventUrl &&
          existingDate === eventDate &&
          existing.is_active === true;

        if (unchanged) {
          stats.eventsUnchanged += 1;
          continue;
        }

        await client.query(
          `UPDATE events
           SET title = $1,
               description = $2,
               google_drive_url = $3,
               preview_images = $4,
               event_date = $5,
               is_active = true,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $6`,
          [title, DRIVE_LIFE_DESCRIPTION, eventUrl, [], eventDate, existing.id]
        );
        stats.eventsUpdated += 1;
        continue;
      }

      await client.query(
        `INSERT INTO events (title, description, google_drive_url, preview_images, event_date, is_active)
         VALUES ($1, $2, $3, $4, $5, true)`,
        [title, DRIVE_LIFE_DESCRIPTION, eventUrl, [], eventDate]
      );
      stats.eventsCreated += 1;
    }

    const archivedEvents = await client.query(
      `UPDATE events
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE is_active = true
         AND description = $1
         AND NOT (google_drive_url = ANY($2::text[]))`,
      [DRIVE_LIFE_DESCRIPTION, activeEventUrls]
    );
    stats.eventsArchived += archivedEvents.rowCount || 0;

    await client.query('COMMIT');

    res.json({
      message: 'Наша жизнь синхронизирована из Google Drive',
      root: driveLife.root,
      ...stats,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Google Drive life sync error:', error);
    res.status(500).json({
      message: error?.message || 'Ошибка синхронизации Google Drive',
    });
  } finally {
    client.release();
  }
});

export default router;
