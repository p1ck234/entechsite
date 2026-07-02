require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const folderId = process.argv[2] || '1vKH5IGGEOy-8fF-BRlsWuVRMcJUgZLIJ';

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

const listChildren = async (drive, parentId) => {
  const files = [];
  let pageToken;
  do {
    const response = await drive.files.list({
      q: `'${parentId}' in parents and trashed=false`,
      corpora: 'allDrives',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      pageSize: 100,
      pageToken,
      fields: 'nextPageToken, files(id, name, mimeType)',
      orderBy: 'name',
    });
    files.push(...(response.data.files || []));
    pageToken = response.data.nextPageToken;
  } while (pageToken);
  return files;
};

const main = async () => {
  const keyFile = findKeyFile();
  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const drive = google.drive({ version: 'v3', auth });

  const root = await drive.files.get({
    fileId: folderId,
    supportsAllDrives: true,
    fields: 'id, name, mimeType',
  });
  console.log('ROOT:', root.data);

  const children = await listChildren(drive, folderId);
  console.log(`\nКурсов/папок верхнего уровня: ${children.length}`);

  for (const child of children.slice(0, 6)) {
    console.log(`\n📁 ${child.name} (${child.mimeType})`);
    if (child.mimeType !== 'application/vnd.google-apps.folder') {
      continue;
    }

    const lessons = await listChildren(drive, child.id);
    for (const lesson of lessons.slice(0, 5)) {
      console.log(`  - ${lesson.name} | ${lesson.mimeType}`);
      if (lesson.mimeType === 'application/vnd.google-apps.folder') {
        const materials = await listChildren(drive, lesson.id);
        materials.slice(0, 4).forEach((item) => {
          console.log(`      * ${item.name} | ${item.mimeType}`);
        });
        if (materials.length > 4) {
          console.log(`      ... ещё ${materials.length - 4}`);
        }
      }
    }
    if (lessons.length > 5) {
      console.log(`  ... ещё ${lessons.length - 5} уроков`);
    }
  }
};

main().catch((error) => {
  console.error('❌', error.message || error);
  process.exit(1);
});
