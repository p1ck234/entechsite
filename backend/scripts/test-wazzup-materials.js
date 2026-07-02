require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { listLessonMaterialsInDriveResource } = require('../dist/services/googleDrive');

const findKeyFile = () => {
  const dirs = [process.cwd(), path.resolve(process.cwd(), '..')];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const fileName of fs.readdirSync(dir)) {
      if (!fileName.endsWith('.json')) continue;
      const fullPath = path.join(dir, fileName);
      try {
        const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        if (parsed.type === 'service_account') return fullPath;
      } catch {
        // skip
      }
    }
  }
  return null;
};

const main = async () => {
  const root = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || '1vKH5IGGEOy-8fF-BRlsWuVRMcJUgZLIJ';
  const auth = new google.auth.GoogleAuth({
    keyFile: findKeyFile(),
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const drive = google.drive({ version: 'v3', auth });

  const response = await drive.files.list({
    q: `'${root}' in parents and name contains 'Wazzup' and trashed=false`,
    corpora: 'allDrives',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    fields: 'files(id,name)',
  });

  const folder = response.data.files?.[0];
  if (!folder) {
    console.error('Папка Wazzup не найдена');
    process.exit(1);
  }

  const materials = await listLessonMaterialsInDriveResource(folder.id);
  console.log(`${folder.name}: ${materials.length} материалов`);
  materials.forEach((item) => console.log(`- ${item.name} | ${item.mimeType}`));
};

main().catch((error) => {
  console.error('❌', error.message || error);
  process.exit(1);
});
