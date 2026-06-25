import express from 'express';
import { Pool } from 'pg';
import { authenticateToken } from '../middleware/auth';
import { DriveCourseFolder, getTrainingDriveTree } from '../services/googleDrive';

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
}

const getUniqueUrls = (...urls: Array<string | undefined>): string[] => {
  return Array.from(new Set(urls.filter(Boolean) as string[]));
};

const getDriveFolderUrl = (folderId: string): string => {
  return `https://drive.google.com/drive/folders/${folderId}`;
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
  for (const [index, lesson] of courseFolder.lessons.entries()) {
    const lessonUrl = getDriveFolderUrl(lesson.id);
    const lessonUrlCandidates = getUniqueUrls(lessonUrl, lesson.webViewLink);
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
        (existing.description || null) === 'Папка Google Drive' &&
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
        [lesson.name, 'Папка Google Drive', lessonUrl, index, existing.id]
      );
      stats.lessonsUpdated += 1;
      continue;
    }

    await client.query(
      `INSERT INTO lessons (course_id, title, description, google_drive_url, duration, order_index, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)`,
      [courseId, lesson.name, 'Папка Google Drive', lessonUrl, null, index]
    );
    stats.lessonsCreated += 1;
  }
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

export default router;
