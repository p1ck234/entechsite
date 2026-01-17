#!/usr/bin/env node

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const distPath = join(__dirname, 'dist');
const assetsPath = join(distPath, 'assets');
const indexPath = join(distPath, 'index.html');

try {
  // Находим актуальные файлы
  const files = readdirSync(assetsPath);
  const jsFile = files.find(f => f.endsWith('.js') && f.startsWith('index-'));
  const cssFile = files.find(f => f.endsWith('.css') && f.startsWith('index-'));

  if (!jsFile || !cssFile) {
    console.error('❌ Не найдены JS или CSS файлы в dist/assets');
    process.exit(1);
  }

  console.log(`📦 Найденные файлы: JS=${jsFile}, CSS=${cssFile}`);

  // Читаем index.html
  let indexContent = readFileSync(indexPath, 'utf-8');

  // Проверяем текущие ссылки
  const currentJsMatch = indexContent.match(/src="\/assets\/([^"]+)"/);
  const currentCssMatch = indexContent.match(/href="\/assets\/([^"]+)"/);

  console.log(`📄 Текущие ссылки: JS=${currentJsMatch?.[1] || 'не найден'}, CSS=${currentCssMatch?.[1] || 'не найден'}`);

  // Обновляем ссылки
  if (currentJsMatch && currentJsMatch[1] !== jsFile) {
    indexContent = indexContent.replace(/src="\/assets\/[^"]+"/, `src="/assets/${jsFile}"`);
    console.log(`✅ Обновлена ссылка на JS: ${currentJsMatch[1]} -> ${jsFile}`);
  }

  if (currentCssMatch && currentCssMatch[1] !== cssFile) {
    indexContent = indexContent.replace(/href="\/assets\/[^"]+"/, `href="/assets/${cssFile}"`);
    console.log(`✅ Обновлена ссылка на CSS: ${currentCssMatch[1]} -> ${cssFile}`);
  }

  // Сохраняем обновлённый index.html
  writeFileSync(indexPath, indexContent, 'utf-8');
  console.log('✅ index.html успешно обновлён');

} catch (error) {
  console.error('❌ Ошибка при исправлении index.html:', error);
  process.exit(1);
}
