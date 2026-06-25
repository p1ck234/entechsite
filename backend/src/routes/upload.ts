import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken } from '../middleware/auth';
import { ensureUploadsDir, resolveUploadedFilePath } from '../utils/uploads';

const router = express.Router();

const uploadsDir = ensureUploadsDir();

// Настройка multer для сохранения файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Генерируем уникальное имя файла
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `photo-${uniqueSuffix}${ext}`);
  }
});

// Фильтр для проверки типа файла
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Разрешаем только изображения
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Разрешены только изображения (jpeg, jpg, png, gif, webp)'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: fileFilter
});

// Роут для загрузки изображения
router.post('/', authenticateToken, (req: any, res: any, next: any) => {
  upload.single('photo')(req, res, (err: any) => {
    if (err) {
      console.error('Multer error:', err);
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'Размер файла превышает 5MB' });
        }
        return res.status(400).json({ message: err.message || 'Ошибка при загрузке файла' });
      }
      return res.status(400).json({ message: err.message || 'Ошибка при загрузке файла' });
    }
    next();
  });
}, (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Файл не был загружен' });
    }

    console.log('File uploaded:', {
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
      path: req.file.path
    });

    // Возвращаем URL для доступа к файлу
    const fileUrl = `/api/uploads/${req.file.filename}`;
    
    res.json({
      message: 'Файл успешно загружен',
      url: fileUrl,
      filename: req.file.filename
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ message: error.message || 'Ошибка при загрузке файла' });
  }
});

// Роут для получения файла
router.get('/:filename', (req: any, res: any) => {
  try {
    const filename = req.params.filename;
    const filePath = resolveUploadedFilePath(filename);

    if (!filePath) {
      return res.status(404).json({ message: 'Файл не найден' });
    }

    // Отправляем файл
    res.sendFile(filePath);
  } catch (error: any) {
    console.error('Get file error:', error);
    res.status(500).json({ message: 'Ошибка при получении файла' });
  }
});

// Роут для удаления файла
router.delete('/:filename', authenticateToken, (req: any, res: any) => {
  try {
    const filename = req.params.filename;
    const filePath = resolveUploadedFilePath(filename);

    if (!filePath) {
      return res.status(404).json({ message: 'Файл не найден' });
    }

    // Удаляем файл
    fs.unlinkSync(filePath);
    
    res.json({ message: 'Файл успешно удален' });
  } catch (error: any) {
    console.error('Delete file error:', error);
    res.status(500).json({ message: 'Ошибка при удалении файла' });
  }
});

export default router;

