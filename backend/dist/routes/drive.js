"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const pg_1 = require("pg");
const auth_1 = require("../middleware/auth");
const googleDrive_1 = require("../services/googleDrive");
const eventMedia_1 = require("../utils/eventMedia");
const driveListCache_1 = require("../utils/driveListCache");
const router = express_1.default.Router();
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://p1ck23@localhost:5432/entechsite',
});
const DRIVE_LIFE_DESCRIPTION = 'Синхронизировано из Google Drive';
const TRANSCODE_MIME_TYPES = new Set([
    'image/heic',
    'image/heif',
    'image/heic-sequence',
    'image/heif-sequence',
]);
let cachedSharpModule = null;
let sharpInitAttempted = false;
const getSharpModule = () => {
    if (sharpInitAttempted) {
        return cachedSharpModule;
    }
    sharpInitAttempted = true;
    try {
        cachedSharpModule = require('sharp');
        return cachedSharpModule;
    }
    catch {
        cachedSharpModule = null;
        return null;
    }
};
const parsePositiveInt = (value, max) => {
    if (typeof value !== 'string') {
        return undefined;
    }
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return undefined;
    }
    return Math.min(parsed, max);
};
const isResizeFit = (value) => {
    return typeof value === 'string' && ['cover', 'contain', 'fill', 'inside', 'outside'].includes(value);
};
const streamToBuffer = async (stream) => {
    const chunks = [];
    return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
    });
};
const optimizeDriveImageBuffer = async (buffer, mimeType, req) => {
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
const getUniqueUrls = (...urls) => {
    return Array.from(new Set(urls.filter(Boolean)));
};
const getDriveFolderUrl = (folderId) => {
    return `https://drive.google.com/drive/folders/${folderId}`;
};
const getDriveFileUrl = (fileId) => {
    return `https://drive.google.com/file/d/${fileId}/view`;
};
const isDriveFolder = (item) => {
    return item.mimeType === 'application/vnd.google-apps.folder';
};
const getLessonUrl = (lesson) => {
    return isDriveFolder(lesson) ? getDriveFolderUrl(lesson.id) : getDriveFileUrl(lesson.id);
};
const getLessonDescription = (lesson) => {
    return isDriveFolder(lesson) ? 'Папка Google Drive' : lesson.mimeType || 'Файл Google Drive';
};
const parseDriveLifeTitle = (name) => {
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
        if (Number.isNaN(parsedDate.getTime()) ||
            parsedDate.getUTCFullYear() !== Number(year) ||
            parsedDate.getUTCMonth() + 1 !== Number(month) ||
            parsedDate.getUTCDate() !== Number(day)) {
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
const buildLifeEventMedia = async (item) => {
    try {
        const mediaItems = await (0, googleDrive_1.listMediaInDriveResource)(item.id);
        const photos = (0, eventMedia_1.mapDriveItemsToEventPhotos)(mediaItems);
        return {
            photos,
            previewImages: (0, eventMedia_1.extractPreviewImageRefs)(photos),
        };
    }
    catch (error) {
        console.warn(`Не удалось получить медиа для "${item.name}":`, error);
        return {
            photos: [],
            previewImages: [],
        };
    }
};
const arePreviewImagesEqual = (left, right) => {
    const normalizedLeft = (left || []).map((value) => value.trim()).filter(Boolean);
    const normalizedRight = (right || []).map((value) => value.trim()).filter(Boolean);
    if (normalizedLeft.length !== normalizedRight.length) {
        return false;
    }
    return normalizedLeft.every((value, index) => value === normalizedRight[index]);
};
const upsertCourse = async (client, courseFolder, stats) => {
    const courseUrl = getDriveFolderUrl(courseFolder.id);
    const courseUrlCandidates = getUniqueUrls(courseUrl, courseFolder.webViewLink);
    const existingCourse = await client.query('SELECT id, title, google_drive_url, is_active FROM courses WHERE google_drive_url = ANY($1::text[]) LIMIT 1', [courseUrlCandidates]);
    if (existingCourse.rows.length > 0) {
        const existing = existingCourse.rows[0];
        const courseId = existing.id;
        if (existing.title === courseFolder.name && existing.google_drive_url === courseUrl && existing.is_active === true) {
            stats.coursesUnchanged += 1;
            return courseId;
        }
        await client.query(`UPDATE courses
       SET title = $1, google_drive_url = $2, is_active = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`, [courseFolder.name, courseUrl, courseId]);
        stats.coursesUpdated += 1;
        return courseId;
    }
    const createdCourse = await client.query(`INSERT INTO courses (title, description, google_drive_url, duration, is_active)
     VALUES ($1, $2, $3, $4, true)
     RETURNING id`, [courseFolder.name, 'Синхронизировано из Google Drive', courseUrl, null]);
    stats.coursesCreated += 1;
    return createdCourse.rows[0].id;
};
const upsertLessons = async (client, courseId, courseFolder, stats) => {
    const activeLessonUrls = [];
    for (const [index, lesson] of courseFolder.lessons.entries()) {
        const lessonUrl = getLessonUrl(lesson);
        const lessonDescription = getLessonDescription(lesson);
        const lessonUrlCandidates = getUniqueUrls(lessonUrl, lesson.webViewLink);
        activeLessonUrls.push(lessonUrl);
        const existingLesson = await client.query(`SELECT id, title, description, google_drive_url, order_index, is_active
       FROM lessons
       WHERE course_id = $1 AND google_drive_url = ANY($2::text[])
       LIMIT 1`, [courseId, lessonUrlCandidates]);
        if (existingLesson.rows.length > 0) {
            const existing = existingLesson.rows[0];
            const unchanged = existing.title === lesson.name &&
                (existing.description || null) === lessonDescription &&
                existing.google_drive_url === lessonUrl &&
                Number(existing.order_index) === index &&
                existing.is_active === true;
            if (unchanged) {
                stats.lessonsUnchanged += 1;
                continue;
            }
            await client.query(`UPDATE lessons
         SET title = $1, description = $2, google_drive_url = $3, order_index = $4, is_active = true, updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`, [lesson.name, lessonDescription, lessonUrl, index, existing.id]);
            stats.lessonsUpdated += 1;
            continue;
        }
        await client.query(`INSERT INTO lessons (course_id, title, description, google_drive_url, duration, order_index, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)`, [courseId, lesson.name, lessonDescription, lessonUrl, null, index]);
        stats.lessonsCreated += 1;
    }
    const archivedLessons = await client.query(`UPDATE lessons
     SET is_active = false, updated_at = CURRENT_TIMESTAMP
     WHERE course_id = $1
       AND is_active = true
       AND NOT (google_drive_url = ANY($2::text[]))`, [courseId, activeLessonUrls]);
    stats.lessonsArchived += archivedLessons.rowCount || 0;
};
router.post('/sync-training', auth_1.authenticateToken, async (req, res) => {
    if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Admin access required' });
    }
    const client = await pool.connect();
    const stats = {
        coursesCreated: 0,
        coursesUpdated: 0,
        coursesUnchanged: 0,
        lessonsCreated: 0,
        lessonsUpdated: 0,
        lessonsUnchanged: 0,
        lessonsArchived: 0,
    };
    try {
        const driveTree = await (0, googleDrive_1.getTrainingDriveTree)();
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
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Google Drive training sync error:', error);
        res.status(500).json({
            message: error?.message || 'Ошибка синхронизации Google Drive',
        });
    }
    finally {
        client.release();
    }
});
router.post('/sync-life', auth_1.authenticateToken, async (req, res) => {
    if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Admin access required' });
    }
    const client = await pool.connect();
    const stats = {
        eventsFound: 0,
        eventsCreated: 0,
        eventsUpdated: 0,
        eventsUnchanged: 0,
        eventsArchived: 0,
        eventsSkippedNoDate: 0,
    };
    const activeEventUrls = [];
    try {
        const driveLife = await (0, googleDrive_1.getLifeDriveItems)();
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
            const { photos, previewImages } = await buildLifeEventMedia(item);
            const existingEvent = await client.query(`SELECT id, title, description, google_drive_url, event_date, preview_images, media_items, is_active
         FROM events
         WHERE google_drive_url = ANY($1::text[])
         LIMIT 1`, [eventUrlCandidates]);
            if (existingEvent.rows.length > 0) {
                const existing = existingEvent.rows[0];
                const existingDate = existing.event_date ? new Date(existing.event_date).toISOString().slice(0, 10) : null;
                const unchanged = existing.title === title &&
                    (existing.description || null) === DRIVE_LIFE_DESCRIPTION &&
                    existing.google_drive_url === eventUrl &&
                    existingDate === eventDate &&
                    arePreviewImagesEqual(existing.preview_images, previewImages) &&
                    (0, eventMedia_1.areEventPhotosEqual)(existing.media_items, photos) &&
                    existing.is_active === true;
                if (unchanged) {
                    stats.eventsUnchanged += 1;
                    continue;
                }
                await client.query(`UPDATE events
           SET title = $1,
               description = $2,
               google_drive_url = $3,
               preview_images = $4,
               event_date = $5,
               media_items = $6::jsonb,
               media_synced_at = CURRENT_TIMESTAMP,
               is_active = true,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $7`, [title, DRIVE_LIFE_DESCRIPTION, eventUrl, previewImages, eventDate, JSON.stringify(photos), existing.id]);
                stats.eventsUpdated += 1;
                continue;
            }
            await client.query(`INSERT INTO events (title, description, google_drive_url, preview_images, event_date, media_items, media_synced_at, is_active)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, CURRENT_TIMESTAMP, true)`, [title, DRIVE_LIFE_DESCRIPTION, eventUrl, previewImages, eventDate, JSON.stringify(photos)]);
            stats.eventsCreated += 1;
        }
        const archivedEvents = await client.query(`UPDATE events
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE is_active = true
         AND description = $1
         AND NOT (google_drive_url = ANY($2::text[]))`, [DRIVE_LIFE_DESCRIPTION, activeEventUrls]);
        stats.eventsArchived += archivedEvents.rowCount || 0;
        await client.query('COMMIT');
        (0, driveListCache_1.invalidateAllDriveListCaches)();
        res.json({
            message: 'Наша жизнь синхронизирована из Google Drive',
            root: driveLife.root,
            ...stats,
        });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Google Drive life sync error:', error);
        res.status(500).json({
            message: error?.message || 'Ошибка синхронизации Google Drive',
        });
    }
    finally {
        client.release();
    }
});
router.get('/files/:fileId/content', auth_1.authenticateToken, async (req, res) => {
    try {
        const { fileId } = req.params;
        const rangeHeader = typeof req.headers.range === 'string' ? req.headers.range : undefined;
        const width = parsePositiveInt(req.query.w, 2048);
        const height = parsePositiveInt(req.query.h, 2048);
        const quality = parsePositiveInt(req.query.q, 100);
        const shouldOptimize = !rangeHeader &&
            (width !== undefined ||
                height !== undefined ||
                quality !== undefined ||
                req.query.fit !== undefined);
        if (shouldOptimize) {
            const { buffer, mimeType, name } = await (0, googleDrive_1.readDriveFileBuffer)(fileId);
            const optimized = await optimizeDriveImageBuffer(buffer, mimeType, req);
            res.setHeader('Content-Type', optimized.contentType);
            res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(name)}"`);
            res.setHeader('Cache-Control', 'private, max-age=86400');
            res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
            return res.send(optimized.buffer);
        }
        const { stream, mimeType, name, statusCode, contentRange, totalSize } = await (0, googleDrive_1.streamDriveMediaContent)(fileId, rangeHeader);
        const isVideo = (0, googleDrive_1.getDriveMediaKind)(mimeType) === 'video';
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
    }
    catch (error) {
        console.error('Drive file content error:', error);
        const isUnsupportedMedia = error?.message?.includes('не поддерживается для просмотра')
            || error?.message?.includes('не является изображением');
        res.status(isUnsupportedMedia ? 415 : 404).json({
            message: error?.message || 'Не удалось получить файл из Google Drive',
        });
    }
});
exports.default = router;
//# sourceMappingURL=drive.js.map