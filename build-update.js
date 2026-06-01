import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

// A custom require function to load CommonJS modules
const require = createRequire(import.meta.url);
const archiver = require('archiver');

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

// 2. Zip the www folder
const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`Update v${version} zipped successfully.`);
});

output.on('error', (err) => {
  throw err;
});

archive.pipe(output);

// Add all files in the www folder, ignoring the zip and json themselves
archive.glob('**/*', {
  cwd: outputDir,
  ignore: ['update.zip', 'update.json']
});

archive.finalize();