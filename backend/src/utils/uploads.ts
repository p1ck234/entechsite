import fs from 'fs';
import path from 'path';

/** Legacy-подпапка Railway Volume для ранее загруженных файлов. */
const UPLOADS_SUBDIR = 'avatars';

export const getUploadsDir = (): string => {
  if (process.env.UPLOADS_DIR) {
    return path.resolve(process.env.UPLOADS_DIR);
  }

  // Оставлено для чтения данных со старого Railway Volume.
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
      `💾 Legacy Railway Volume подключён: ${process.env.RAILWAY_VOLUME_MOUNT_PATH} → ${uploadsDir}`
    );
    return;
  }

  if (process.env.NODE_ENV === 'production' && !process.env.UPLOADS_DIR) {
    console.log(`💾 Production uploads path: ${uploadsDir}`);
    console.log(`   В Coolify подключите Persistent Storage к ${uploadsDir}`);
    return;
  }

  console.log('💻 Локальное хранилище uploads');
};
