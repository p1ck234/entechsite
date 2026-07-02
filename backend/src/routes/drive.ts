import express from 'express';
import { pool } from '../db/pool';
import type sharp from 'sharp';
import { authenticateToken } from '../middleware/auth';
import { DriveCourseFolder, DriveFileItem, getDriveMediaKind, getLifeDriveItems, getTrainingDriveTree, listMediaInDriveResource, readDriveFileBuffer, streamDriveMediaContent, toDriveImageRef } from '../services/googleDrive';
import {
  areEventPhotosEqual,
  extractPreviewImageRefs,
  mapDriveItemsToEventPhotos,
} from '../utils/eventMedia';
import { invalidateAllDriveListCaches } from '../utils/driveListCache';

const router = express.Router();

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

type ResizeFit = 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
type SharpModule = typeof sharp;

const TRANSCODE_MIME_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);

let cachedSharpModule: SharpModule | null = null;
let sharpInitAttempted = false;

const getSharpModule = (): SharpModule | null => {
  if (sharpInitAttempted) {
    return cachedSharpModule;
  }

  sharpInitAttempted = true;

  try {
    cachedSharpModule = require('sharp') as SharpModule;
    return cachedSharpModule;
  } catch {
    cachedSharpModule = null;
    return null;
  }
};

const parsePositiveInt = (value: unknown, max: number): number | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Math.min(parsed, max);
};

const isResizeFit = (value: unknown): value is ResizeFit => {
  return typeof value === 'string' && ['cover', 'contain', 'fill', 'inside', 'outside'].includes(value);
};

const streamToBuffer = async (stream: NodeJS.ReadableStream): Promise<Buffer> => {
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
};

const optimizeDriveImageBuffer = async (
  buffer: Buffer,
  mimeType: string,
  req: express.Request
): Promise<{ buffer: Buffer; contentType: string }> => {
  const width = parsePositiveInt(req.query.w, 2048);
  const height = parsePositiveInt(req.query.h, 2048);
  const quality = parsePositiveInt(req.query.q, 100);
  const fit = isResizeFit(req.query.fit) ? req.query.fit : 'cover';
  const shouldTranscode = TRANSCODE_MIME_TYPES.has(mimeType.toLowerCase());
  const shouldResize = width !== undefined || height !== undefined || quality !== undefined || req.query.fit !== undefined;

  if (!shouldTranscode && !shouldResize) {
    return { buffer, contentType: mimeType };
  }

  const sharpModule = getSharpModule();
  if (!sharpModule) {
    return { buffer, contentType: mimeType };
  }

  const acceptHeader = typeof req.headers.accept === 'string' ? req.headers.accept : '';
  const prefersWebp = acceptHeader.includes('image/webp');
  const normalizedQuality = quality ?? 76;

  let transformer = sharpModule(buffer, { failOn: 'none' }).rotate();
  if (width !== undefined || height !== undefined) {
    transformer = transformer.resize({
      width,
      height,
      fit,
      withoutEnlargement: true,
    });
  }

  if (prefersWebp) {
    return {
      buffer: await transformer.webp({ quality: normalizedQuality }).toBuffer(),
      contentType: 'image/webp',
    };
  }

  if (shouldTranscode || mimeType === 'image/png') {
    return {
      buffer: await transformer.jpeg({ quality: normalizedQuality, mozjpeg: true }).toBuffer(),
      contentType: 'image/jpeg',
    };
  }

  return {
    buffer: await transformer.toBuffer(),
    contentType: mimeType,
  };
};

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

const buildLifeEventMedia = async (item: DriveFileItem) => {
  try {
    const mediaItems = await listMediaInDriveResource(item.id);
    const photos = mapDriveItemsToEventPhotos(mediaItems);
    return {
      photos,
      previewImages: extractPreviewImageRefs(photos),
    };
  } catch (error) {
    console.warn(`Не удалось получить медиа для "${item.name}":`, error);
    return {
      photos: [],
      previewImages: [],
    };
  }
};

const arePreviewImagesEqual = (left: string[] | null | undefined, right: string[] | null | undefined): boolean => {
  const normalizedLeft = (left || []).map((value) => value.trim()).filter(Boolean);
  const normalizedRight = (right || []).map((value) => value.trim()).filter(Boolean);

  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }

  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
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

  const stats: SyncStats = {
    coursesCreated: 0,
    coursesUpdated: 0,
    coursesUnchanged: 0,
    lessonsCreated: 0,
    lessonsUpdated: 0,
    lessonsUnchanged: 0,
    lessonsArchived: 0,
  };

  let client;

  try {
    const driveTree = await getTrainingDriveTree();
    client = await pool.connect();

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
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // транзакция могла не начаться
      }
    }
    console.error('Google Drive training sync error:', error);
    res.status(500).json({
      message: error?.message || 'Ошибка синхронизации Google Drive',
    });
  } finally {
    client?.release();
  }
});

router.post('/sync-life', authenticateToken, async (req: any, res: any) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Admin access required' });
  }

  const stats: LifeSyncStats = {
    eventsFound: 0,
    eventsCreated: 0,
    eventsUpdated: 0,
    eventsUnchanged: 0,
    eventsArchived: 0,
    eventsSkippedNoDate: 0,
  };

  let client;

  try {
    const driveLife = await getLifeDriveItems();
    stats.eventsFound = driveLife.items.length;

    const preparedEvents: Array<{
      eventUrl: string;
      eventUrlCandidates: string[];
      title: string;
      eventDate: string;
      photos: ReturnType<typeof mapDriveItemsToEventPhotos>;
      previewImages: string[];
    }> = [];

    for (const item of driveLife.items) {
      const eventUrl =
        item.webViewLink || (isDriveFolder(item) ? getDriveFolderUrl(item.id) : getDriveFileUrl(item.id));
      const eventUrlCandidates = getUniqueUrls(eventUrl, item.webViewLink);
      const { title, eventDate } = parseDriveLifeTitle(item.name);

      if (!eventDate) {
        stats.eventsSkippedNoDate += 1;
        continue;
      }

      const { photos, previewImages } = await buildLifeEventMedia(item);
      preparedEvents.push({
        eventUrl,
        eventUrlCandidates,
        title,
        eventDate,
        photos,
        previewImages,
      });
    }

    const activeEventUrls = preparedEvents.map((event) => event.eventUrl);
    client = await pool.connect();
    await client.query('BEGIN');

    for (const prepared of preparedEvents) {
      const existingEvent = await client.query(
        `SELECT id, title, description, google_drive_url, event_date, preview_images, media_items, is_active
         FROM events
         WHERE google_drive_url = ANY($1::text[])
         LIMIT 1`,
        [prepared.eventUrlCandidates]
      );

      if (existingEvent.rows.length > 0) {
        const existing = existingEvent.rows[0];
        const existingDate = existing.event_date
          ? new Date(existing.event_date).toISOString().slice(0, 10)
          : null;
        const unchanged =
          existing.title === prepared.title &&
          (existing.description || null) === DRIVE_LIFE_DESCRIPTION &&
          existing.google_drive_url === prepared.eventUrl &&
          existingDate === prepared.eventDate &&
          arePreviewImagesEqual(existing.preview_images, prepared.previewImages) &&
          areEventPhotosEqual(existing.media_items, prepared.photos) &&
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
               media_items = $6::jsonb,
               media_synced_at = CURRENT_TIMESTAMP,
               is_active = true,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $7`,
          [
            prepared.title,
            DRIVE_LIFE_DESCRIPTION,
            prepared.eventUrl,
            prepared.previewImages,
            prepared.eventDate,
            JSON.stringify(prepared.photos),
            existing.id,
          ]
        );
        stats.eventsUpdated += 1;
        continue;
      }

      await client.query(
        `INSERT INTO events (title, description, google_drive_url, preview_images, event_date, media_items, media_synced_at, is_active)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, CURRENT_TIMESTAMP, true)`,
        [
          prepared.title,
          DRIVE_LIFE_DESCRIPTION,
          prepared.eventUrl,
          prepared.previewImages,
          prepared.eventDate,
          JSON.stringify(prepared.photos),
        ]
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
    invalidateAllDriveListCaches();

    res.json({
      message: 'Наша жизнь синхронизирована из Google Drive',
      root: driveLife.root,
      ...stats,
    });
  } catch (error: any) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // транзакция могла не начаться
      }
    }
    console.error('Google Drive life sync error:', error);
    res.status(500).json({
      message: error?.message || 'Ошибка синхронизации Google Drive',
    });
  } finally {
    client?.release();
  }
});

router.get('/files/:fileId/content', authenticateToken, async (req: any, res: any) => {
  try {
    const { fileId } = req.params;
    const rangeHeader = typeof req.headers.range === 'string' ? req.headers.range : undefined;
    const width = parsePositiveInt(req.query.w, 2048);
    const height = parsePositiveInt(req.query.h, 2048);
    const quality = parsePositiveInt(req.query.q, 100);
    const shouldOptimize =
      !rangeHeader &&
      (width !== undefined ||
        height !== undefined ||
        quality !== undefined ||
        req.query.fit !== undefined);

    if (shouldOptimize) {
      const { buffer, mimeType, name } = await readDriveFileBuffer(fileId);
      const optimized = await optimizeDriveImageBuffer(buffer, mimeType, req);

      res.setHeader('Content-Type', optimized.contentType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(name)}"`);
      res.setHeader('Cache-Control', 'private, max-age=86400');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      return res.send(optimized.buffer);
    }

    const { stream, mimeType, name, statusCode, contentRange, totalSize } = await streamDriveMediaContent(
      fileId,
      rangeHeader
    );
    const isVideo = getDriveMediaKind(mimeType) === 'video';

    if (!isVideo && TRANSCODE_MIME_TYPES.has(mimeType.toLowerCase())) {
      const sourceBuffer = await streamToBuffer(stream);
      const optimized = await optimizeDriveImageBuffer(sourceBuffer, mimeType, req);

      res.setHeader('Content-Type', optimized.contentType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(name)}"`);
      res.setHeader('Cache-Control', 'private, max-age=86400');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      return res.send(optimized.buffer);
    }

    res.status(statusCode);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(name)}"`);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Accept-Ranges', 'bytes');

    if (contentRange) {
      res.setHeader('Content-Range', contentRange);
    }

    if (totalSize && statusCode === 200) {
      res.setHeader('Content-Length', String(totalSize));
    }

    stream.on('error', (error) => {
      console.error('Drive file stream error:', error);
      if (!res.headersSent) {
        res.status(502).json({ message: 'Ошибка чтения файла из Google Drive' });
      }
    });

    stream.pipe(res);
  } catch (error: any) {
    console.error('Drive file content error:', error);
    const isUnsupportedMedia = error?.message?.includes('не поддерживается для просмотра')
      || error?.message?.includes('не является изображением');
    res.status(isUnsupportedMedia ? 415 : 404).json({
      message: error?.message || 'Не удалось получить файл из Google Drive',
    });
  }
});

export default router;
