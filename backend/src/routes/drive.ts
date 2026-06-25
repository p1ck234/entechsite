import express from 'express';
import { Pool } from 'pg';
import { authenticateToken } from '../middleware/auth';
import { DriveCourseFolder, DriveFileItem, getDriveFileDownload, getTrainingDriveTree } from '../services/googleDrive';

const router = express.Router();
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
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

const getDriveFolderUrl = (folderId: string): string => {
  return `https://drive.google.com/drive/folders/${folderId}`;
};

const getDriveFileUrl = (fileId: string): string => {
  return `https://drive.google.com/file/d/${fileId}/view`;
};

const getUniqueUrls = (...urls: Array<string | undefined>): string[] => {
  return Array.from(new Set(urls.filter(Boolean) as string[]));
};

const getDriveItemCanonicalUrl = (item: DriveFileItem): string => {
  return item.mimeType === FOLDER_MIME_TYPE ? getDriveFolderUrl(item.id) : getDriveFileUrl(item.id);
};

const getDriveItemUrlCandidates = (item: DriveFileItem): string[] => {
  return getUniqueUrls(getDriveItemCanonicalUrl(item), item.webViewLink);
};

const getLessonDescription = (lesson: DriveCourseFolder['lessons'][number]): string | null => {
  return lesson.mimeType === FOLDER_MIME_TYPE ? 'Материалы Google Drive' : lesson.mimeType || null;
};

const serializeMaterials = (materials: DriveFileItem[]) => {
  return JSON.stringify(materials.map((material) => ({
    id: material.id,
    name: material.name,
    mimeType: material.mimeType || null,
    webViewLink: material.webViewLink,
    modifiedTime: material.modifiedTime || null,
  })));
};

const normalizeMaterials = (materials: unknown): string => {
  if (typeof materials === 'string') {
    try {
      return JSON.stringify(JSON.parse(materials));
    } catch {
      return materials;
    }
  }

  return JSON.stringify(materials || []);
};

const migrateMaterialProgressToLesson = async (
  client: any,
  courseId: number,
  lessonId: number,
  materials: DriveFileItem[]
): Promise<void> => {
  const materialUrls = materials.flatMap(getDriveItemUrlCandidates);

  if (materialUrls.length === 0) {
    return;
  }

  await client.query(
    `INSERT INTO lesson_progress (user_id, lesson_id, completed, completed_at)
     SELECT lp.user_id,
            $2,
            bool_and(lp.completed),
            CASE WHEN bool_and(lp.completed) THEN max(lp.completed_at) ELSE NULL END
     FROM lessons l
     JOIN lesson_progress lp ON lp.lesson_id = l.id
     WHERE l.course_id = $1
       AND l.id <> $2
       AND l.google_drive_url = ANY($3::text[])
     GROUP BY lp.user_id
     ON CONFLICT (user_id, lesson_id)
     DO UPDATE SET
       completed = lesson_progress.completed OR EXCLUDED.completed,
       completed_at = COALESCE(lesson_progress.completed_at, EXCLUDED.completed_at)`,
    [courseId, lessonId, materialUrls]
  );
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

const archiveMaterialFileLessons = async (
  client: any,
  courseId: number,
  parentLessonId: number,
  materials: DriveFileItem[],
  stats: SyncStats
): Promise<void> => {
  const materialUrls = materials.flatMap(getDriveItemUrlCandidates);

  if (materialUrls.length === 0) {
    return;
  }

  const archivedLessons = await client.query(
    `UPDATE lessons
     SET is_active = false, updated_at = CURRENT_TIMESTAMP
     WHERE course_id = $1
       AND id <> $2
       AND google_drive_url = ANY($3::text[])
       AND is_active = true`,
    [courseId, parentLessonId, materialUrls]
  );

  stats.lessonsArchived += archivedLessons.rowCount || 0;
};

const upsertLessons = async (client: any, courseId: number, courseFolder: DriveCourseFolder, stats: SyncStats): Promise<void> => {
  for (const [index, lesson] of courseFolder.lessons.entries()) {
    const lessonUrl = getDriveItemCanonicalUrl(lesson);
    const lessonUrlCandidates = getDriveItemUrlCandidates(lesson);
    const lessonDescription = getLessonDescription(lesson);
    const materialsJson = serializeMaterials(lesson.materials);
    const isFolderLesson = lesson.mimeType === FOLDER_MIME_TYPE;

    const existingLesson = await client.query(
      `SELECT id, title, description, google_drive_url, materials, order_index, is_active
       FROM lessons
       WHERE course_id = $1 AND google_drive_url = ANY($2::text[])
       LIMIT 1`,
      [courseId, lessonUrlCandidates]
    );

    if (existingLesson.rows.length > 0) {
      const existing = existingLesson.rows[0];
      const lessonId = existing.id;
      const unchanged =
        existing.title === lesson.name &&
        (existing.description || null) === lessonDescription &&
        existing.google_drive_url === lessonUrl &&
        normalizeMaterials(existing.materials) === materialsJson &&
        Number(existing.order_index) === index &&
        existing.is_active === true;

      if (unchanged) {
        stats.lessonsUnchanged += 1;
      } else {
        await client.query(
          `UPDATE lessons
           SET title = $1, description = $2, google_drive_url = $3, materials = $4::jsonb, order_index = $5, is_active = true, updated_at = CURRENT_TIMESTAMP
           WHERE id = $6`,
          [lesson.name, lessonDescription, lessonUrl, materialsJson, index, lessonId]
        );
        stats.lessonsUpdated += 1;
      }

      await client.query(
        `UPDATE lessons
         SET is_active = false, updated_at = CURRENT_TIMESTAMP
         WHERE course_id = $1
           AND id <> $2
           AND google_drive_url = ANY($3::text[])
           AND is_active = true`,
        [courseId, lessonId, lessonUrlCandidates]
      );

      await migrateMaterialProgressToLesson(client, courseId, lessonId, lesson.materials);
      if (isFolderLesson) {
        await archiveMaterialFileLessons(client, courseId, lessonId, lesson.materials, stats);
      }
      continue;
    }

    const createdLesson = await client.query(
      `INSERT INTO lessons (course_id, title, description, google_drive_url, materials, duration, order_index, is_active)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, true)
       RETURNING id`,
      [courseId, lesson.name, lessonDescription, lessonUrl, materialsJson, null, index]
    );
    const lessonId = createdLesson.rows[0].id;
    await migrateMaterialProgressToLesson(client, courseId, lessonId, lesson.materials);
    if (isFolderLesson) {
      await archiveMaterialFileLessons(client, courseId, lessonId, lesson.materials, stats);
    }
    stats.lessonsCreated += 1;
  }
};

router.get('/files/:fileId', authenticateToken, async (req: any, res: any) => {
  try {
    const download = await getDriveFileDownload(req.params.fileId);
    const encodedFilename = encodeURIComponent(download.filename);

    res.setHeader('Content-Type', download.mimeType);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedFilename}`);
    res.setHeader('Cache-Control', 'private, max-age=300');

    download.stream.on('error', (error) => {
      console.error('Google Drive file stream error:', error);
      if (!res.headersSent) {
        res.status(502).json({ message: 'Ошибка чтения файла Google Drive' });
      } else {
        res.destroy(error);
      }
    });
    download.stream.pipe(res);
  } catch (error: any) {
    console.error('Google Drive file download error:', error);
    res.status(500).json({ message: error?.message || 'Ошибка открытия файла Google Drive' });
  }
});

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

export default router;
