import fs from 'fs';
import path from 'path';

const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const version = packageJson.version;

const outputDir = './www';

// Create update.json with a cache-busting query parameter
const updateData = {
  latestVersion: version,
  url: `https://scholars-prep.vercel.app/update.zip?v=${version}` 
};

fs.writeFileSync(path.join(outputDir, 'update.json'), JSON.stringify(updateData, null, 2));
console.log(`Update.json generated for version ${version} with cache-buster.`);