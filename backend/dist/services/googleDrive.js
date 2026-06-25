"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTrainingDriveTree = void 0;
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
const getCredentialsPathCandidates = () => {
    const candidates = [
        process.env.GOOGLE_APPLICATION_CREDENTIALS,
        path_1.default.resolve(process.cwd(), 'credentials.json'),
        path_1.default.resolve(process.cwd(), '../credentials.json'),
        path_1.default.resolve(__dirname, '../../../credentials.json'),
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
const getFileWebViewLink = (file) => {
    if (file.webViewLink) {
        return file.webViewLink;
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
        webViewLink: getFileWebViewLink(file),
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
const findRootFolder = async (drive) => {
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    if (rootFolderId) {
        const response = await drive.files.get({
            fileId: rootFolderId,
            supportsAllDrives: true,
            fields: 'id, name, mimeType, webViewLink, modifiedTime',
        });
        return mapDriveFile(response.data);
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
const listFolderFilesRecursive = async (drive, folderId, prefix = '') => {
    const children = await listFolderChildren(drive, folderId);
    const files = [];
    for (const child of children) {
        if (child.mimeType === FOLDER_MIME_TYPE) {
            const nestedPrefix = prefix ? `${prefix} / ${child.name}` : child.name;
            files.push(...await listFolderFilesRecursive(drive, child.id, nestedPrefix));
            continue;
        }
        files.push({
            ...child,
            name: prefix ? `${prefix} / ${child.name}` : child.name,
        });
    }
    return files;
};
const getTrainingDriveTree = async () => {
    const drive = getDriveClient();
    const root = await findRootFolder(drive);
    const rootChildren = await listFolderChildren(drive, root.id);
    const courseFolders = sortDriveItemsByName(rootChildren.filter((item) => item.mimeType === FOLDER_MIME_TYPE));
    const courses = await Promise.all(courseFolders.map(async (folder) => ({
        ...folder,
        lessons: await listFolderFilesRecursive(drive, folder.id),
    })));
    return { root, courses };
};
exports.getTrainingDriveTree = getTrainingDriveTree;
//# sourceMappingURL=googleDrive.js.map