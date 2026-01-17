import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const distPath = join(__dirname, 'dist');

// Раздача статических файлов из dist (должно быть первым!)
app.use(express.static(distPath, {
  // Не отправлять index.html для статических файлов
  index: false,
  // Добавляем заголовки для кэширования
  maxAge: '1y',
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
    console.warn(`⚠️ Статический файл не найден: ${req.path}`);
    return res.status(404).send('Not found');
  }

  // Для всех остальных путей отдаём index.html (SPA роутинг)
  res.sendFile(join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Frontend server running on port ${PORT}`);
});

