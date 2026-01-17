import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const distPath = join(__dirname, 'dist');

// Проверяем наличие dist и логируем доступные файлы при старте
if (existsSync(distPath)) {
  try {
    const assetsPath = join(distPath, 'assets');
    if (existsSync(assetsPath)) {
      const files = readdirSync(assetsPath);
      console.log('📦 Доступные файлы в dist/assets:', files);
    }
  } catch (error) {
    console.error('⚠️ Ошибка при чтении dist/assets:', error);
  }
} else {
  console.error('❌ Папка dist не найдена! Убедитесь, что выполнен npm run build');
}

// Раздача статических файлов из dist (должно быть первым!)
app.use(express.static(distPath, {
  // Не отправлять index.html для статических файлов
  index: false,
  // Кэширование для продакшена, но не слишком агрессивное
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : '0',
  etag: true,
  lastModified: true
}));

// Для SPA - все остальные маршруты на index.html
// ВАЖНО: не перехватываем запросы к статическим файлам (assets, .js, .css и т.д.)
app.get('*', (req, res) => {
  // Если это запрос к статическому файлу, не отдаём index.html
  if (
    req.path.startsWith('/assets/') ||
    req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map)$/i)
  ) {
    const filePath = join(distPath, req.path);
    console.warn(`⚠️ Статический файл не найден: ${req.path}`);
    if (existsSync(filePath)) {
      console.warn(`   Но файл существует по пути: ${filePath}`);
    } else {
      console.warn(`   Файл не существует по пути: ${filePath}`);
    }
    return res.status(404).send('Not found');
  }

  // Для всех остальных путей отдаём index.html (SPA роутинг)
  res.sendFile(join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Frontend server running on port ${PORT}`);
});

