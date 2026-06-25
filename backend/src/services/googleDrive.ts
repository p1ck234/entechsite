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

export interface DriveLessonItem extends DriveFileItem {
  materials: DriveFileItem[];
}

export interface DriveCourseFolder extends DriveFileItem {
  lessons: DriveLessonItem[];
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

const getCredentialsPathCandidates = (): string[] => {
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.resolve(process.cwd(), 'credentials.json'),
    path.resolve(process.cwd(), '../credentials.json'),
    path.resolve(__dirname, '../../../credentials.json'),
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

const GOOGLE_DOC_EXPORT_MIME_TYPE = 'application/pdf';

const getFileWebViewLink = (file: drive_v3.Schema$File): string => {
  if (file.webViewLink) {
    return file.webViewLink;
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
    webViewLink: getFileWebViewLink(file),
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

const findRootFolder = async (drive: drive_v3.Drive): Promise<DriveFileItem> => {
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

const listFolderChildren = async (drive: drive_v3.Drive, folderId: string): Promise<DriveFileItem[]> => {
  const files = await listAllFiles(drive, {
    q: `'${escapeDriveQueryValue(folderId)}' in parents and trashed=false`,
    corpora: 'allDrives',
    orderBy: 'name',
    pageSize: 1000,
  });

  return files.map(mapDriveFile);
};

const listFolderFilesRecursive = async (drive: drive_v3.Drive, folderId: string, prefix = ''): Promise<DriveFileItem[]> => {
  const children = await listFolderChildren(drive, folderId);
  const files: DriveFileItem[] = [];

  for (const child of sortDriveItemsByName(children)) {
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

const listCourseLessons = async (drive: drive_v3.Drive, folderId: string): Promise<DriveLessonItem[]> => {
  const children = sortDriveItemsByName(await listFolderChildren(drive, folderId));
  const lessons = await Promise.all(
    children.map(async (child): Promise<DriveLessonItem> => {
      if (child.mimeType === FOLDER_MIME_TYPE) {
        return {
          ...child,
          materials: await listFolderFilesRecursive(drive, child.id),
        };
      }

      return {
        ...child,
        materials: [child],
      };
    })
  );

  return lessons.filter((lesson) => lesson.materials.length > 0);
};

export const getTrainingDriveTree = async (): Promise<{ root: DriveFileItem; courses: DriveCourseFolder[] }> => {
  const drive = getDriveClient();
  const root = await findRootFolder(drive);
  const rootChildren = await listFolderChildren(drive, root.id);
  const courseFolders = sortDriveItemsByName(rootChildren.filter((item) => item.mimeType === FOLDER_MIME_TYPE));

  const courses = await Promise.all(
    courseFolders.map(async (folder) => ({
      ...folder,
      lessons: await listCourseLessons(drive, folder.id),
    }))
  );

  return { root, courses };
};

export const getDriveFileDownload = async (fileId: string): Promise<{
  filename: string;
  mimeType: string;
  stream: NodeJS.ReadableStream;
}> => {
  const drive = getDriveClient();
  const metadataResponse = await drive.files.get({
    fileId,
    supportsAllDrives: true,
    fields: 'id, name, mimeType',
  });
  const file = metadataResponse.data;

  if (!file.id || !file.name) {
    throw new Error('Google Drive returned a file without id or name.');
  }

  if (file.mimeType?.startsWith('application/vnd.google-apps.')) {
    const exportResponse = await drive.files.export(
      {
        fileId,
        mimeType: GOOGLE_DOC_EXPORT_MIME_TYPE,
      },
      { responseType: 'stream' }
    );

    return {
      filename: `${file.name}.pdf`,
      mimeType: GOOGLE_DOC_EXPORT_MIME_TYPE,
      stream: exportResponse.data as NodeJS.ReadableStream,
    };
  }

  const response = await drive.files.get(
    {
      fileId,
      alt: 'media',
      supportsAllDrives: true,
    },
    { responseType: 'stream' }
  );

  return {
    filename: file.name,
    mimeType: file.mimeType || 'application/octet-stream',
    stream: response.data as NodeJS.ReadableStream,
  };
};
