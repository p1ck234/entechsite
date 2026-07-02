/**
 * Проверка Google Drive credentials и папки «Фотогалерея».
 * Запуск: node scripts/test-google-drive.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const IGNORED_JSON = new Set(['package.json', 'package-lock.json', 'tsconfig.json', 'railway.json']);

const findServiceAccountFile = () => {
  const dirs = [
    process.cwd(),
    path.resolve(process.cwd(), '..'),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;

    for (const fileName of fs.readdirSync(dir)) {
      if (!fileName.endsWith('.json') || IGNORED_JSON.has(fileName)) continue;

      const fullPath = path.join(dir, fileName);
      try {
        const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        if (parsed.type === 'service_account' && parsed.client_email) {
          return { fullPath, clientEmail: parsed.client_email };
        }
      } catch {
        // skip
      }
    }
  }

  return null;
};

const main = async () => {
  const folderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_PHOTO_ID;

  if (!folderId) {
    console.error('❌ GOOGLE_DRIVE_ROOT_FOLDER_PHOTO_ID не задан в backend/.env');
    console.error('   Откройте папку «Фотогалерея» и скопируйте ID из URL.');
    process.exit(1);
  }

  const discovered = findServiceAccountFile();
  const keyFile =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    (discovered ? discovered.fullPath : null);

  if (!keyFile || !fs.existsSync(keyFile)) {
    console.error('❌ JSON service account не найден.');
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  const drive = google.drive({ version: 'v3', auth });
  const credentials = JSON.parse(fs.readFileSync(keyFile, 'utf8'));

  console.log('✅ Credentials:', keyFile);
  console.log('📧 client_email:', credentials.client_email);
  console.log('📁 Photo root folder ID:', folderId);
  console.log('');
  console.log('Убедитесь, что этот email добавлен в общий диск «Корпоративное» как Читатель.');
  console.log('');

  const folder = await drive.files.get({
    fileId: folderId,
    supportsAllDrives: true,
    fields: 'id, name, mimeType',
  });

  console.log('✅ Папка найдена:', folder.data.name);

  const children = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    corpora: 'allDrives',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    pageSize: 20,
    fields: 'files(id, name, mimeType)',
    orderBy: 'name',
  });

  const items = children.data.files || [];
  console.log(`\n📂 Элементов в папке: ${items.length}`);

  for (const item of items.slice(0, 10)) {
    console.log(`  - ${item.name} (${item.mimeType})`);
  }

  if (items.length > 10) {
    console.log(`  ... и ещё ${items.length - 10}`);
  }

  console.log('\nЕсли список пустой или ошибка 404 — проверьте доступ service account к общему диску.');
};

main().catch((error) => {
  console.error('❌ Ошибка:', error.message || error);
  process.exit(1);
});
