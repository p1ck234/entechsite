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
  lessonsCreated: number;
  lessonsUpdated: number;
}

const getDriveFolderUrl = (folderId: string): string => {
  return `https://drive.google.com/drive/folders/${folderId}`;
};

const getDriveFileUrl = (fileId: string): string => {
  return `https://drive.google.com/file/d/${fileId}/view`;
};

const upsertCourse = async (client: any, courseFolder: DriveCourseFolder, stats: SyncStats): Promise<number> => {
  const courseUrl = courseFolder.webViewLink || getDriveFolderUrl(courseFolder.id);
  const existingCourse = await client.query('SELECT id FROM courses WHERE google_drive_url = $1', [courseUrl]);

  if (existingCourse.rows.length > 0) {
    const courseId = existingCourse.rows[0].id;
    await client.query(
      `UPDATE courses
       SET title = $1, is_active = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [courseFolder.name, courseId]
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
    const lessonUrl = lesson.webViewLink || getDriveFileUrl(lesson.id);
    const existingLesson = await client.query(
      'SELECT id FROM lessons WHERE course_id = $1 AND google_drive_url = $2',
      [courseId, lessonUrl]
    );

    if (existingLesson.rows.length > 0) {
      await client.query(
        `UPDATE lessons
         SET title = $1, order_index = $2, is_active = true, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [lesson.name, index, existingLesson.rows[0].id]
      );
      stats.lessonsUpdated += 1;
      continue;
    }

    await client.query(
      `INSERT INTO lessons (course_id, title, description, google_drive_url, duration, order_index, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)`,
      [courseId, lesson.name, lesson.mimeType || null, lessonUrl, null, index]
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
    lessonsCreated: 0,
    lessonsUpdated: 0,
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
