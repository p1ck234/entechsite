"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const pg_1 = require("pg");
const auth_1 = require("../middleware/auth");
const googleDrive_1 = require("../services/googleDrive");
const router = express_1.default.Router();
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://p1ck23@localhost:5432/entechsite',
});
const DRIVE_LIFE_DESCRIPTION = 'Синхронизировано из Google Drive';
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
const buildLifePreviewImages = async (item) => {
    try {
        const images = await (0, googleDrive_1.listImagesInDriveResource)(item.id);
        return images.slice(0, 4).map((image) => (0, googleDrive_1.toDriveImageRef)(image.id));
    }
    catch (error) {
        console.warn(`Не удалось получить превью для "${item.name}":`, error);
        return [];
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
            const previewImages = await buildLifePreviewImages(item);
            const existingEvent = await client.query(`SELECT id, title, description, google_drive_url, event_date, preview_images, is_active
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
               is_active = true,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $6`, [title, DRIVE_LIFE_DESCRIPTION, eventUrl, previewImages, eventDate, existing.id]);
                stats.eventsUpdated += 1;
                continue;
            }
            await client.query(`INSERT INTO events (title, description, google_drive_url, preview_images, event_date, is_active)
         VALUES ($1, $2, $3, $4, $5, true)`, [title, DRIVE_LIFE_DESCRIPTION, eventUrl, previewImages, eventDate]);
            stats.eventsCreated += 1;
        }
        const archivedEvents = await client.query(`UPDATE events
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE is_active = true
         AND description = $1
         AND NOT (google_drive_url = ANY($2::text[]))`, [DRIVE_LIFE_DESCRIPTION, activeEventUrls]);
        stats.eventsArchived += archivedEvents.rowCount || 0;
        await client.query('COMMIT');
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
        const { stream, mimeType, name } = await (0, googleDrive_1.streamDriveFileContent)(fileId);
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(name)}"`);
        res.setHeader('Cache-Control', 'private, max-age=86400');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
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
        res.status(error?.message?.includes('не является изображением') ? 415 : 404).json({
            message: error?.message || 'Не удалось получить файл из Google Drive',
        });
    }
});
exports.default = router;
//# sourceMappingURL=drive.js.map