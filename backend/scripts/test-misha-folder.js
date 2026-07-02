require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

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
  const folderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_PHOTO_ID;
  const keyFile = findKeyFile();
  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const drive = google.drive({ version: 'v3', auth });

  const children = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    corpora: 'allDrives',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    pageSize: 100,
    fields: 'files(id, name, mimeType)',
    orderBy: 'name',
  });

  const target = (children.data.files || []).find((item) => /миш/i.test(item.name || ''));
  console.log('Folder:', target);

  if (!target) return;

  const files = await drive.files.list({
    q: `'${target.id}' in parents and trashed=false`,
    corpora: 'allDrives',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    pageSize: 100,
    fields: 'files(id, name, mimeType, size)',
    orderBy: 'name',
  });

  console.log('\nChildren:', files.data.files?.length || 0);
  for (const file of files.data.files || []) {
    console.log(` - ${file.name} | ${file.mimeType} | ${file.id}`);
  }

  const { listMediaInDriveResource } = require('../dist/services/googleDrive');
  const media = await listMediaInDriveResource(target.id);
  console.log('\nlistMediaInDriveResource:', media.length);
  media.forEach((item) => console.log(`  * ${item.name} (${item.mimeType})`));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
