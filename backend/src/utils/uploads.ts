import fs from 'fs';
import path from 'path';

/** Подпапка на Railway Volume — все аватарки и upload-фото хранятся здесь */
const UPLOADS_SUBDIR = 'avatars';

const isRailwayRuntime = (): boolean =>
  Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);

export const getUploadsDir = (): string => {
  if (process.env.UPLOADS_DIR) {
    return path.resolve(process.env.UPLOADS_DIR);
  }

  // Railway автоматически задаёт путь при подключении Volume
  if (process.env.RAILWAY_VOLUME_MOUNT_PATH) {
    return path.resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH, UPLOADS_SUBDIR);
  }

  return path.resolve(process.cwd(), 'uploads');
};

/** Все директории, где могут лежать ранее загруженные файлы */
export const getUploadsSearchDirs = (): string[] => {
  const dirs = new Set<string>([getUploadsDir()]);

  if (process.env.RAILWAY_VOLUME_MOUNT_PATH) {
    dirs.add(path.resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH));
    dirs.add(path.resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH, UPLOADS_SUBDIR));
  }

  if (process.env.UPLOADS_DIR) {
    dirs.add(path.resolve(process.env.UPLOADS_DIR));
  }

  dirs.add(path.resolve(process.cwd(), 'uploads'));
  dirs.add(path.resolve(__dirname, '../uploads'));
  dirs.add(path.resolve(__dirname, '../../uploads'));

  return Array.from(dirs);
};

export const ensureUploadsDir = (): string => {
  const uploadsDir = getUploadsDir();

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log(`📁 Создана папка для загрузок: ${uploadsDir}`);
  }

  return uploadsDir;
};

export const resolveUploadedFilePath = (filename: string): string | null => {
  const safeFilename = path.basename(filename);

  for (const dir of getUploadsSearchDirs()) {
    const filePath = path.join(dir, safeFilename);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }

  return null;
};

export const logUploadsStorageStatus = (): void => {
  const uploadsDir = getUploadsDir();

  console.log(`📁 Uploads directory: ${uploadsDir}`);

  if (process.env.RAILWAY_VOLUME_MOUNT_PATH) {
    console.log(
      `💾 Railway Volume подключён: ${process.env.RAILWAY_VOLUME_MOUNT_PATH} → ${uploadsDir}`
    );
    return;
  }

  if (isRailwayRuntime()) {
    console.warn('⚠️ Railway Volume не подключён — фото пропадут при redeploy');
    console.warn('   Backend → Volumes → Add Volume → mount path: /data/uploads');
    return;
  }

  console.log('💻 Локальное хранилище uploads (для production нужен Railway Volume)');
};
