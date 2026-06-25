import fs from 'fs';
import path from 'path';

export const getUploadsDir = (): string => {
  if (process.env.UPLOADS_DIR) {
    return path.resolve(process.env.UPLOADS_DIR);
  }

  return path.resolve(process.cwd(), 'uploads');
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
  const candidates = [
    getUploadsDir(),
    path.resolve(__dirname, '../uploads'),
    path.resolve(__dirname, '../../uploads'),
  ];

  for (const dir of Array.from(new Set(candidates))) {
    const filePath = path.join(dir, safeFilename);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }

  return null;
};
