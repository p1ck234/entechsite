"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamDriveFileContent = exports.listImagesInDriveResource = exports.extractDriveResourceIdFromUrl = exports.parseDriveImageRef = exports.toDriveImageRef = exports.DRIVE_IMAGE_REF_PREFIX = exports.getLifeDriveItems = exports.getTrainingDriveTree = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const googleapis_1 = require("googleapis");
const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const DEFAULT_ROOT_FOLDER_NAME = 'Обучение';
const sortDriveItemsByName = (items) => {
    return [...items].sort((first, second) => first.name.localeCompare(second.name, 'ru', {
        numeric: true,
        sensitivity: 'base',
    }));
};
const escapeDriveQueryValue = (value) => {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
};
const parseServiceAccountJson = (value) => {
    const trimmedValue = value.trim();
    if (trimmedValue.startsWith('{')) {
        return JSON.parse(trimmedValue);
    }
    return JSON.parse(Buffer.from(trimmedValue, 'base64').toString('utf8'));
};
const IGNORED_JSON_FILENAMES = new Set([
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'tsconfig.app.json',
    'tsconfig.node.json',
    'railway.json',
]);
const isServiceAccountKeyFile = (filePath) => {
    try {
        const rawContent = fs_1.default.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(rawContent);
        return parsed.type === 'service_account' && Boolean(parsed.client_email);
    }
    catch {
        return false;
    }
};
const findServiceAccountKeyFiles = (directoryPath) => {
    if (!fs_1.default.existsSync(directoryPath)) {
        return [];
    }
    return fs_1.default
        .readdirSync(directoryPath)
        .filter((fileName) => fileName.endsWith('.json') && !IGNORED_JSON_FILENAMES.has(fileName))
        .map((fileName) => path_1.default.join(directoryPath, fileName))
        .filter(isServiceAccountKeyFile)
        .sort();
};
const getCredentialsPathCandidates = () => {
    const searchDirectories = [
        process.cwd(),
        path_1.default.resolve(process.cwd(), '..'),
        path_1.default.resolve(__dirname, '../../..'),
        path_1.default.resolve(__dirname, '../../../..'),
    ];
    const discoveredKeyFiles = searchDirectories.flatMap(findServiceAccountKeyFiles);
    const candidates = [
        process.env.GOOGLE_APPLICATION_CREDENTIALS,
        path_1.default.resolve(process.cwd(), 'credentials.json'),
        path_1.default.resolve(process.cwd(), '../credentials.json'),
        path_1.default.resolve(__dirname, '../../../credentials.json'),
        ...discoveredKeyFiles,
    ].filter(Boolean);
    return Array.from(new Set(candidates));
};
const getGoogleAuth = () => {
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
    if (serviceAccountJson) {
        return new googleapis_1.google.auth.GoogleAuth({
            credentials: parseServiceAccountJson(serviceAccountJson),
            scopes: [DRIVE_READONLY_SCOPE],
        });
    }
    const credentialsPath = getCredentialsPathCandidates().find((candidate) => fs_1.default.existsSync(candidate));
    if (!credentialsPath) {
        throw new Error('Google Drive credentials not found. Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.');
    }
    return new googleapis_1.google.auth.GoogleAuth({
        keyFile: credentialsPath,
        scopes: [DRIVE_READONLY_SCOPE],
    });
};
const getDriveClient = () => {
    return googleapis_1.google.drive({
        version: 'v3',
        auth: getGoogleAuth(),
    });
};
const getDriveWebViewLink = (file) => {
    if (file.webViewLink) {
        return file.webViewLink;
    }
    if (file.mimeType === FOLDER_MIME_TYPE) {
        return `https://drive.google.com/drive/folders/${file.id}`;
    }
    return `https://drive.google.com/file/d/${file.id}/view`;
};
const mapDriveFile = (file) => {
    if (!file.id || !file.name) {
        throw new Error('Google Drive returned a file without id or name.');
    }
    return {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType || undefined,
        webViewLink: getDriveWebViewLink(file),
        modifiedTime: file.modifiedTime || undefined,
    };
};
const listAllFiles = async (drive, params) => {
    const files = [];
    let pageToken;
    do {
        const response = await drive.files.list({
            ...params,
            pageToken,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
            fields: 'nextPageToken, files(id, name, mimeType, webViewLink, modifiedTime)',
        });
        files.push(...(response.data.files || []));
        pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);
    return files;
};
const getFolderById = async (drive, folderId) => {
    const response = await drive.files.get({
        fileId: folderId,
        supportsAllDrives: true,
        fields: 'id, name, mimeType, webViewLink, modifiedTime',
    });
    return mapDriveFile(response.data);
};
const findTrainingRootFolder = async (drive) => {
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    if (rootFolderId) {
        return getFolderById(drive, rootFolderId);
    }
    const rootFolderName = process.env.GOOGLE_DRIVE_ROOT_FOLDER_NAME || DEFAULT_ROOT_FOLDER_NAME;
    const folders = await listAllFiles(drive, {
        q: `mimeType='${FOLDER_MIME_TYPE}' and name='${escapeDriveQueryValue(rootFolderName)}' and trashed=false`,
        corpora: 'allDrives',
        pageSize: 10,
    });
    if (folders.length === 0) {
        throw new Error(`Google Drive root folder "${rootFolderName}" not found for service account.`);
    }
    return mapDriveFile(folders[0]);
};
const listFolderChildren = async (drive, folderId) => {
    const files = await listAllFiles(drive, {
        q: `'${escapeDriveQueryValue(folderId)}' in parents and trashed=false`,
        corpora: 'allDrives',
        orderBy: 'name',
        pageSize: 1000,
    });
    return sortDriveItemsByName(files.map(mapDriveFile));
};
const listDirectLessons = async (drive, courseFolderId) => {
    const children = await listFolderChildren(drive, courseFolderId);
    const folders = children.filter((child) => child.mimeType === FOLDER_MIME_TYPE);
    if (folders.length > 0) {
        return sortDriveItemsByName(folders);
    }
    return sortDriveItemsByName(children.filter((child) => child.mimeType !== FOLDER_MIME_TYPE));
};
const getTrainingDriveTree = async () => {
    const drive = getDriveClient();
    const root = await findTrainingRootFolder(drive);
    const rootChildren = await listFolderChildren(drive, root.id);
    const courseFolders = sortDriveItemsByName(rootChildren.filter((item) => item.mimeType === FOLDER_MIME_TYPE));
    const courses = await Promise.all(courseFolders.map(async (folder) => ({
        ...folder,
        lessons: await listDirectLessons(drive, folder.id),
    })));
    return { root, courses };
};
exports.getTrainingDriveTree = getTrainingDriveTree;
const getLifeDriveItems = async () => {
    const drive = getDriveClient();
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_PHOTO_ID;
    if (!rootFolderId) {
        throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_PHOTO_ID is not configured.');
    }
    const root = await getFolderById(drive, rootFolderId);
    const items = await listFolderChildren(drive, root.id);
    return { root, items };
};
exports.getLifeDriveItems = getLifeDriveItems;
exports.DRIVE_IMAGE_REF_PREFIX = 'drive:';
const toDriveImageRef = (fileId) => `${exports.DRIVE_IMAGE_REF_PREFIX}${fileId}`;
exports.toDriveImageRef = toDriveImageRef;
const parseDriveImageRef = (value) => {
    if (!value.startsWith(exports.DRIVE_IMAGE_REF_PREFIX)) {
        return null;
    }
    const fileId = value.slice(exports.DRIVE_IMAGE_REF_PREFIX.length).trim();
    return fileId || null;
};
exports.parseDriveImageRef = parseDriveImageRef;
const extractDriveResourceIdFromUrl = (url) => {
    const trimmedUrl = url.trim();
    const folderMatch = trimmedUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (folderMatch?.[1]) {
        return folderMatch[1];
    }
    const fileMatch = trimmedUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch?.[1]) {
        return fileMatch[1];
    }
    const openMatch = trimmedUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (openMatch?.[1]) {
        return openMatch[1];
    }
    return null;
};
exports.extractDriveResourceIdFromUrl = extractDriveResourceIdFromUrl;
const isImageMimeType = (mimeType) => {
    return Boolean(mimeType?.startsWith('image/'));
};
const listImagesInDriveResource = async (resourceIdOrUrl) => {
    const drive = getDriveClient();
    const resourceId = resourceIdOrUrl.includes('http')
        ? (0, exports.extractDriveResourceIdFromUrl)(resourceIdOrUrl)
        : resourceIdOrUrl;
    if (!resourceId) {
        throw new Error('Не удалось определить ID папки или файла Google Drive.');
    }
    const resourceResponse = await drive.files.get({
        fileId: resourceId,
        supportsAllDrives: true,
        fields: 'id, name, mimeType, webViewLink, modifiedTime',
    });
    const resource = mapDriveFile(resourceResponse.data);
    if (isImageMimeType(resource.mimeType)) {
        return [resource];
    }
    if (resource.mimeType !== FOLDER_MIME_TYPE) {
        return [];
    }
    const children = await listFolderChildren(drive, resource.id);
    return children.filter((child) => isImageMimeType(child.mimeType));
};
exports.listImagesInDriveResource = listImagesInDriveResource;
const streamDriveFileContent = async (fileId) => {
    const drive = getDriveClient();
    const metaResponse = await drive.files.get({
        fileId,
        supportsAllDrives: true,
        fields: 'id, name, mimeType',
    });
    if (!metaResponse.data.id) {
        throw new Error('Файл Google Drive не найден.');
    }
    if (!isImageMimeType(metaResponse.data.mimeType || undefined)) {
        throw new Error('Запрошенный файл не является изображением.');
    }
    const contentResponse = await drive.files.get({
        fileId,
        supportsAllDrives: true,
        alt: 'media',
    }, { responseType: 'stream' });
    return {
        stream: contentResponse.data,
        mimeType: metaResponse.data.mimeType || 'application/octet-stream',
        name: metaResponse.data.name || fileId,
    };
};
exports.streamDriveFileContent = streamDriveFileContent;
//# sourceMappingURL=googleDrive.js.map