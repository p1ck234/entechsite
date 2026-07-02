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

const listFolderChildren = async (drive, folderId) => {
  const files = [];
  let pageToken;
  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
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
  const folderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_PHOTO_ID;
  const keyFile = findKeyFile();
  if (!keyFile) throw new Error('No service account key');

  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const drive = google.drive({ version: 'v3', auth });

  const children = await listFolderChildren(drive, folderId);
  const target = children.find((item) => /global/i.test(item.name || ''));
  console.log('Target event folder:', target);

  if (!target) return;

  const rootChildren = await listFolderChildren(drive, target.id);
  const rootImages = rootChildren.filter((item) => item.mimeType?.startsWith('image/'));
  console.log('\nImages in folder root:', rootImages.length);
  rootImages.slice(0, 6).forEach((img) => console.log(' -', img.name, img.mimeType, img.id));

  const subfolders = rootChildren.filter((item) => item.mimeType === 'application/vnd.google-apps.folder');
  console.log('\nSubfolders:', subfolders.length);
  for (const sub of subfolders.slice(0, 3)) {
    const subChildren = await listFolderChildren(drive, sub.id);
    const subImages = subChildren.filter((item) => item.mimeType?.startsWith('image/'));
    console.log(`  ${sub.name}: ${subImages.length} images`);
    subImages.slice(0, 2).forEach((img) => console.log('    -', img.name, img.mimeType));
  }

  const sampleId = rootImages[0]?.id || (subfolders[0] && (await listFolderChildren(drive, subfolders[0].id)).find((i) => i.mimeType?.startsWith('image/'))?.id);
  const videos = rootChildren.filter((item) => item.mimeType?.startsWith('video/'));
  console.log('\nVideos in folder root:', videos.length);
  videos.slice(0, 6).forEach((video) => console.log(' -', video.name, video.mimeType, video.id));

  if (sampleId) {
    const meta = await drive.files.get({ fileId: sampleId, supportsAllDrives: true, fields: 'name,mimeType,size' });
    console.log('\nSample file meta:', meta.data);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
