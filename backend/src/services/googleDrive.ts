import fs from 'fs';
import path from 'path';
import { google, drive_v3 } from 'googleapis';

const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const DEFAULT_ROOT_FOLDER_NAME = 'Обучение';

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType?: string;
  webViewLink: string;
  modifiedTime?: string;
}

export interface DriveCourseFolder extends DriveFileItem {
  lessons: DriveFileItem[];
}

const sortDriveItemsByName = <T extends DriveFileItem>(items: T[]): T[] => {
  return [...items].sort((first, second) =>
    first.name.localeCompare(second.name, 'ru', {
      numeric: true,
      sensitivity: 'base',
    })
  );
};

const escapeDriveQueryValue = (value: string): string => {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
};

const parseServiceAccountJson = (value: string): unknown => {
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

const isServiceAccountKeyFile = (filePath: string): boolean => {
  try {
    const rawContent = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(rawContent) as { type?: string; client_email?: string };

    return parsed.type === 'service_account' && Boolean(parsed.client_email);
  } catch {
    return false;
  }
};

const findServiceAccountKeyFiles = (directoryPath: string): string[] => {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  return fs
    .readdirSync(directoryPath)
    .filter((fileName) => fileName.endsWith('.json') && !IGNORED_JSON_FILENAMES.has(fileName))
    .map((fileName) => path.join(directoryPath, fileName))
    .filter(isServiceAccountKeyFile)
    .sort();
};

const getCredentialsPathCandidates = (): string[] => {
  const searchDirectories = [
    process.cwd(),
    path.resolve(process.cwd(), '..'),
    path.resolve(__dirname, '../../..'),
    path.resolve(__dirname, '../../../..'),
  ];

  const discoveredKeyFiles = searchDirectories.flatMap(findServiceAccountKeyFiles);

  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.resolve(process.cwd(), 'credentials.json'),
    path.resolve(process.cwd(), '../credentials.json'),
    path.resolve(__dirname, '../../../credentials.json'),
    ...discoveredKeyFiles,
  ].filter(Boolean) as string[];

  return Array.from(new Set(candidates));
};

const getGoogleAuth = () => {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;

  if (serviceAccountJson) {
    return new google.auth.GoogleAuth({
      credentials: parseServiceAccountJson(serviceAccountJson) as any,
      scopes: [DRIVE_READONLY_SCOPE],
    });
  }

  const credentialsPath = getCredentialsPathCandidates().find((candidate) => fs.existsSync(candidate));

  if (!credentialsPath) {
    throw new Error('Google Drive credentials not found. Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.');
  }

  return new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: [DRIVE_READONLY_SCOPE],
  });
};

const getDriveClient = (): drive_v3.Drive => {
  return google.drive({
    version: 'v3',
    auth: getGoogleAuth(),
  });
};

const getDriveWebViewLink = (file: drive_v3.Schema$File): string => {
  if (file.webViewLink) {
    return file.webViewLink;
  }

  if (file.mimeType === FOLDER_MIME_TYPE) {
    return `https://drive.google.com/drive/folders/${file.id}`;
  }

  return `https://drive.google.com/file/d/${file.id}/view`;
};

const mapDriveFile = (file: drive_v3.Schema$File): DriveFileItem => {
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

const listAllFiles = async (drive: drive_v3.Drive, params: drive_v3.Params$Resource$Files$List): Promise<drive_v3.Schema$File[]> => {
  const files: drive_v3.Schema$File[] = [];
  let pageToken: string | undefined;

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

const getFolderById = async (drive: drive_v3.Drive, folderId: string): Promise<DriveFileItem> => {
  const response = await drive.files.get({
    fileId: folderId,
    supportsAllDrives: true,
    fields: 'id, name, mimeType, webViewLink, modifiedTime',
  });

  return mapDriveFile(response.data);
};

const findTrainingRootFolder = async (drive: drive_v3.Drive): Promise<DriveFileItem> => {
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

const listFolderChildren = async (drive: drive_v3.Drive, folderId: string): Promise<DriveFileItem[]> => {
  const files = await listAllFiles(drive, {
    q: `'${escapeDriveQueryValue(folderId)}' in parents and trashed=false`,
    corpora: 'allDrives',
    orderBy: 'name',
    pageSize: 1000,
  });

  return sortDriveItemsByName(files.map(mapDriveFile));
};

const listDirectLessons = async (drive: drive_v3.Drive, courseFolderId: string): Promise<DriveFileItem[]> => {
  const children = await listFolderChildren(drive, courseFolderId);
  const folders = children.filter((child) => child.mimeType === FOLDER_MIME_TYPE);

  if (folders.length > 0) {
    return sortDriveItemsByName(folders);
  }

  return sortDriveItemsByName(children.filter((child) => child.mimeType !== FOLDER_MIME_TYPE));
};

export const getTrainingDriveTree = async (): Promise<{ root: DriveFileItem; courses: DriveCourseFolder[] }> => {
  const drive = getDriveClient();
  const root = await findTrainingRootFolder(drive);
  const rootChildren = await listFolderChildren(drive, root.id);
  const courseFolders = sortDriveItemsByName(rootChildren.filter((item) => item.mimeType === FOLDER_MIME_TYPE));

  const courses = await Promise.all(
    courseFolders.map(async (folder) => ({
      ...folder,
      lessons: await listDirectLessons(drive, folder.id),
    }))
  );

  return { root, courses };
};

export const getLifeDriveItems = async (): Promise<{ root: DriveFileItem; items: DriveFileItem[] }> => {
  const drive = getDriveClient();
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_PHOTO_ID;

  if (!rootFolderId) {
    throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_PHOTO_ID is not configured.');
  }

  const root = await getFolderById(drive, rootFolderId);
  const items = await listFolderChildren(drive, root.id);

  return { root, items };
};

export const DRIVE_IMAGE_REF_PREFIX = 'drive:';

export const toDriveImageRef = (fileId: string): string => `${DRIVE_IMAGE_REF_PREFIX}${fileId}`;

export const parseDriveImageRef = (value: string): string | null => {
  if (!value.startsWith(DRIVE_IMAGE_REF_PREFIX)) {
    return null;
  }

  const fileId = value.slice(DRIVE_IMAGE_REF_PREFIX.length).trim();
  return fileId || null;
};

export const extractDriveResourceIdFromUrl = (url: string): string | null => {
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

const isImageMimeType = (mimeType?: string): boolean => {
  return Boolean(mimeType?.startsWith('image/'));
};

export const listImagesInDriveResource = async (resourceIdOrUrl: string): Promise<DriveFileItem[]> => {
  const drive = getDriveClient();
  const resourceId = resourceIdOrUrl.includes('http')
    ? extractDriveResourceIdFromUrl(resourceIdOrUrl)
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

export const streamDriveFileContent = async (
  fileId: string
): Promise<{ stream: NodeJS.ReadableStream; mimeType: string; name: string }> => {
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

  const contentResponse = await drive.files.get(
    {
      fileId,
      supportsAllDrives: true,
      alt: 'media',
    },
    { responseType: 'stream' }
  );

  return {
    stream: contentResponse.data as NodeJS.ReadableStream,
    mimeType: metaResponse.data.mimeType || 'application/octet-stream',
    name: metaResponse.data.name || fileId,
  };
};
