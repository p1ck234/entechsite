import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const distPath = join(__dirname, 'dist');

// Раздача статических файлов из dist
app.use(express.static(distPath));

// Для SPA - все остальные маршруты на index.html
// express.static автоматически обработает существующие файлы и не передаст управление дальше
app.get('*', (req, res) => {
  res.sendFile(join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Frontend server running on port ${PORT}`);
});

