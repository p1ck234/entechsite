require('dotenv').config();

console.log('🔍 Проверка переменных окружения...\n');

// Все переменные, связанные с базой данных
const dbVars = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_DATABASE_URL',
  'DATABASE_CONNECTION_STRING',
  'PGHOST',
  'PGPORT',
  'PGUSER',
  'PGPASSWORD',
  'PGDATABASE',
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME'
];

console.log('📊 Переменные базы данных:');
dbVars.forEach(key => {
  const value = process.env[key];
  if (value) {
    // Маскируем чувствительные данные
    if (key.includes('PASSWORD') || key.includes('SECRET')) {
      console.log(`   ${key}: ${'*'.repeat(10)}`);
    } else if (key === 'DATABASE_URL' && value.length > 30) {
      const masked = `${value.substring(0, 20)}...${value.substring(value.length - 10)}`;
      console.log(`   ${key}: ${masked}`);
    } else {
      console.log(`   ${key}: ${value}`);
    }
  } else {
    console.log(`   ${key}: ❌ не установлена`);
  }
});

console.log('\n📋 Все переменные окружения (первые 50):');
const allVars = Object.keys(process.env).slice(0, 50);
allVars.forEach(key => {
  const value = process.env[key];
  if (key.includes('RAILWAY') || key.includes('POSTGRES') || key.includes('DATABASE') || key.includes('PG')) {
    console.log(`   ${key}: ${value ? (value.length > 50 ? value.substring(0, 50) + '...' : value) : '<empty>'}`);
  }
});

console.log('\n📁 Хранилище фото (uploads):');
const uploadsVars = ['UPLOADS_DIR', 'RAILWAY_VOLUME_MOUNT_PATH', 'RAILWAY_VOLUME_NAME'];
uploadsVars.forEach((key) => {
  const value = process.env[key];
  console.log(`   ${key}: ${value || '❌ не установлена'}`);
});
if (process.env.RAILWAY_VOLUME_MOUNT_PATH) {
  console.log(`   → Фото сохраняются в: ${process.env.RAILWAY_VOLUME_MOUNT_PATH}/avatars`);
} else if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID) {
  console.log('   ⚠️ Volume не подключён — фото пропадут при redeploy');
  console.log('   → Backend → Volumes → mount path: /data/uploads');
} else {
  console.log(`   → Локально: ${process.env.UPLOADS_DIR || './uploads'}`);
}

console.log('\n💡 Для Railway:');
console.log('   1. Откройте проект в Railway');
console.log('   2. Посмотрите список сервисов');
console.log('   3. Найдите PostgreSQL сервис (обычно называется "Postgres" или "PostgreSQL")');
console.log('   4. В backend сервисе → Variables → DATABASE_URL');
console.log('   5. Используйте: ${{ИМЯ_СЕРВИСА.DATABASE_URL}}');
console.log('   6. Для аватарок: backend → Volumes → Add Volume → /data/uploads');

