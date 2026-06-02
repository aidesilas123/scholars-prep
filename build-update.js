import fs from 'fs';
import path from 'path';

async function buildUpdate() {
  const archiverModule = await import('archiver');
  const archiver = archiverModule.default || archiverModule;

  const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
  const version = packageJson.version;

  const outputDir = './www';
  const zipPath = path.join(outputDir, 'update.zip');

  // 1. Create update.json
  const updateData = {
    latestVersion: version,
    url: `https://scholars-prep.vercel.app/update.zip` 
  };
  fs.writeFileSync(path.join(outputDir, 'update.json'), JSON.stringify(updateData, null, 2));

  // 2. Setup the Zip Stream
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  // 3. STRICT PROMISE: Force Vercel to wait until the file finishes writing to disk
  await new Promise((resolve, reject) => {
    output.on('close', () => {
      console.log(`Update v${version} fully written to disk (${archive.pointer()} bytes).`);
      resolve();
    });

    archive.on('error', (err) => {
      console.error('Archiver Error:', err);
      reject(err);
    });

    archive.pipe(output);

    // Add all files in the www folder, ignoring the zip and json
    archive.glob('**/*', {
      cwd: outputDir,
      ignore: ['update.zip', 'update.json']
    });

    archive.finalize();
  });
}

buildUpdate().catch(console.error);