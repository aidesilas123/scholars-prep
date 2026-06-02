import fs from 'fs';
import path from 'path';

const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const version = packageJson.version;

const outputDir = './www';

// Create update.json (Reverted to pure .zip)
const updateData = {
  latestVersion: version,
  url: `https://scholars-prep.vercel.app/update.zip` 
};

fs.writeFileSync(path.join(outputDir, 'update.json'), JSON.stringify(updateData, null, 2));
console.log(`Update.json generated for version ${version}`);