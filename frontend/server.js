import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readdirSync, readFileSync } from 'fs';

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
    
    // Проверяем содержимое index.html
    const indexPath = join(distPath, 'index.html');
    if (existsSync(indexPath)) {
      const indexContent = readFileSync(indexPath, 'utf-8');
      // Извлекаем ссылки на JS и CSS файлы
      const jsMatch = indexContent.match(/src="\/assets\/([^"]+)"/);
      const cssMatch = indexContent.match(/href="\/assets\/([^"]+)"/);
      console.log('📄 index.html ссылается на:');
      console.log('   JS:', jsMatch ? jsMatch[1] : 'не найден');
      console.log('   CSS:', cssMatch ? cssMatch[1] : 'не найден');
    }
  } catch (error) {
    console.error('⚠️ Ошибка при чтении dist:', error);
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
      // Если файл существует, но express.static его не нашёл, отдаём вручную
      return res.sendFile(filePath);
    } else {
      console.warn(`   Файл не существует по пути: ${filePath}`);
      // Показываем список доступных файлов для отладки
      try {
        const assetsPath = join(distPath, 'assets');
        if (existsSync(assetsPath)) {
          const files = readdirSync(assetsPath);
          console.warn(`   Доступные файлы: ${files.join(', ')}`);
        }
      } catch (err) {
        // Игнорируем ошибки при чтении
      }
      return res.status(404).send('Not found');
    }
  }

  // Для всех остальных путей отдаём index.html (SPA роутинг)
  const indexPath = join(distPath, 'index.html');
  if (!existsSync(indexPath)) {
    console.error('❌ index.html не найден! Убедитесь, что выполнен npm run build');
    return res.status(500).send('Build files not found. Please rebuild the application.');
  }
  // Запрещаем кэширование index.html, чтобы всегда отдавать актуальную версию
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(indexPath);
});

app.listen(PORT, () => {
  console.log(`🚀 Frontend server running on port ${PORT}`);
});

