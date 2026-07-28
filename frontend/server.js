import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const API_PROXY_TARGET = (process.env.API_PROXY_TARGET || 'https://api.entech.p1ck23.ru').replace(/\/+$/, '');

const distPath = join(__dirname, 'dist');

// Healthcheck для Coolify и балансировщиков.
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'OK', service: 'frontend' });
});

// Проверяем наличие dist и логируем доступные файлы при старте
console.log('🔍 Проверка dist при старте сервера...');
console.log('📁 Путь к dist:', distPath);
console.log('📁 Текущая рабочая директория:', process.cwd());

if (existsSync(distPath)) {
  try {
    const assetsPath = join(distPath, 'assets');
    if (existsSync(assetsPath)) {
      const files = readdirSync(assetsPath);
      console.log('📦 Доступные файлы в dist/assets:', files);
      
      // Проверяем, что файлы действительно существуют
      files.forEach(file => {
        const filePath = join(assetsPath, file);
        const stats = existsSync(filePath) ? statSync(filePath) : null;
        console.log(`   ${file}: ${stats ? `${(stats.size / 1024).toFixed(2)} KB` : 'не найден'}`);
      });
    } else {
      console.error('❌ Папка dist/assets не найдена!');
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
      
      // Проверяем, существуют ли файлы, на которые ссылается index.html
      if (jsMatch) {
        const jsPath = join(assetsPath, jsMatch[1]);
        console.log(`   JS файл существует: ${existsSync(jsPath)}`);
      }
      if (cssMatch) {
        const cssPath = join(assetsPath, cssMatch[1]);
        console.log(`   CSS файл существует: ${existsSync(cssPath)}`);
      }
    } else {
      console.error('❌ index.html не найден!');
    }
  } catch (error) {
    console.error('⚠️ Ошибка при чтении dist:', error);
  }
  
  // Если index.html ссылается на несуществующие файлы, исправляем это
  try {
    const indexPath = join(distPath, 'index.html');
    const assetsPath = join(distPath, 'assets');
    if (existsSync(indexPath) && existsSync(assetsPath)) {
      let indexContent = readFileSync(indexPath, 'utf-8');
      const jsMatch = indexContent.match(/src="\/assets\/([^"]+)"/);
      const cssMatch = indexContent.match(/href="\/assets\/([^"]+)"/);
      
      if (jsMatch && !existsSync(join(assetsPath, jsMatch[1]))) {
        console.warn('⚠️ index.html ссылается на несуществующий JS файл, исправляем...');
        const files = readdirSync(assetsPath);
        const jsFile = files.find(f => f.endsWith('.js') && f.startsWith('index-'));
        if (jsFile) {
          indexContent = indexContent.replace(/src="\/assets\/[^"]+"/, `src="/assets/${jsFile}"`);
          console.log(`✅ Обновлена ссылка на JS: ${jsMatch[1]} -> ${jsFile}`);
        }
      }
      
      if (cssMatch && !existsSync(join(assetsPath, cssMatch[1]))) {
        console.warn('⚠️ index.html ссылается на несуществующий CSS файл, исправляем...');
        const files = readdirSync(assetsPath);
        const cssFile = files.find(f => f.endsWith('.css') && f.startsWith('index-'));
        if (cssFile) {
          indexContent = indexContent.replace(/href="\/assets\/[^"]+"/, `href="/assets/${cssFile}"`);
          console.log(`✅ Обновлена ссылка на CSS: ${cssMatch[1]} -> ${cssFile}`);
        }
      }
      
      // Если были изменения, сохраняем
      if (jsMatch && !existsSync(join(assetsPath, jsMatch[1])) || cssMatch && !existsSync(join(assetsPath, cssMatch[1]))) {
        writeFileSync(indexPath, indexContent, 'utf-8');
        console.log('✅ index.html исправлен при старте сервера');
      }
    }
  } catch (error) {
    console.error('⚠️ Ошибка при исправлении index.html:', error);
  }
} else {
  console.error('❌ Папка dist не найдена! Убедитесь, что выполнен npm run build');
  console.error('   Искали по пути:', distPath);
}

// Проксируем /api на backend, чтобы относительные ссылки /api/uploads/... не попадали в SPA.
app.use('/api', async (req, res) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const targetUrl = new URL(`/api${req.originalUrl.replace(/^\/api/, '')}`, API_PROXY_TARGET);
    const headers = new Headers();

    Object.entries(req.headers).forEach(([key, value]) => {
      if (value === undefined || key.toLowerCase() === 'host') {
        return;
      }

      if (Array.isArray(value)) {
        headers.set(key, value.join(', '));
      } else {
        headers.set(key, value);
      }
    });

    const upstreamResponse = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : req,
      duplex: ['GET', 'HEAD'].includes(req.method) ? undefined : 'half',
      redirect: 'manual',
      signal: controller.signal,
    });

    res.status(upstreamResponse.status);
    upstreamResponse.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (!upstreamResponse.body) {
      return res.end();
    }

    const reader = upstreamResponse.body.getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        res.write(Buffer.from(value));
      }
      res.end();
    };

    return pump().catch((error) => {
      console.error('⚠️ Ошибка proxy stream /api:', error);
      if (!res.headersSent) {
        res.status(502).json({ message: 'Ошибка proxy /api' });
      } else {
        res.destroy(error);
      }
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      return res.status(504).json({ message: 'Таймаут proxy /api' });
    }

    console.error('⚠️ Ошибка proxy /api:', error);
    return res.status(502).json({ message: 'Ошибка proxy /api' });
  } finally {
    clearTimeout(timeoutId);
  }
});

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
      return res.type('text/plain').status(404).send('Static asset not found');
    }
  }

  // Для всех остальных путей отдаём index.html (SPA роутинг)
  const indexPath = join(distPath, 'index.html');
  if (!existsSync(indexPath)) {
    console.error('❌ index.html не найден! Убедитесь, что выполнен npm run build');
    return res.status(500).send('Build files not found. Please rebuild the application.');
  }
  
  // Запрещаем кэширование index.html, чтобы всегда отдавать актуальную версию
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.sendFile(indexPath);
});

app.listen(PORT, () => {
  console.log(`🚀 Frontend server running on port ${PORT}`);
});

