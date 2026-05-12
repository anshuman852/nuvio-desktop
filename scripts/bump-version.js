/**
 * Bump version across all project files.
 * Usage: node scripts/bump-version.js <new_version>
 * Example: node scripts/bump-version.js 2.4.0
 */

const fs = require('fs');
const path = require('path');

const newVersion = process.argv[2];
if (!newVersion || !/^\d+\.\d+\.\d+$/.test(newVersion)) {
  console.error('Usage: node scripts/bump-version.js <semver>');
  console.error('Example: node scripts/bump-version.js 2.4.0');
  process.exit(1);
}

const root = path.resolve(__dirname, '..');

const files = [
  {
    path: path.join(root, 'package.json'),
    replace: (content) => content.replace(/"version": "\d+\.\d+\.\d+"/, `"version": "${newVersion}"`),
  },
  {
    path: path.join(root, 'package-lock.json'),
    replace: (content) => content.replace(/"version": "\d+\.\d+\.\d+"/g, `"version": "${newVersion}"`),
  },
  {
    path: path.join(root, 'src-tauri', 'tauri.conf.json'),
    replace: (content) => content.replace(/"version": "\d+\.\d+\.\d+"/, `"version": "${newVersion}"`),
  },
  {
    path: path.join(root, 'src-tauri', 'Cargo.toml'),
    replace: (content) => content.replace(/^version = "\d+\.\d+\.\d+"/m, `version = "${newVersion}"`),
  },
];

let updated = 0;
for (const file of files) {
  if (!fs.existsSync(file.path)) {
    console.warn(`⚠ Skipping (not found): ${file.path}`);
    continue;
  }
  const original = fs.readFileSync(file.path, 'utf-8');
  const updatedContent = file.replace(original);
  if (original === updatedContent) {
    console.warn(`⚠ No version pattern found in: ${file.path}`);
    continue;
  }
  fs.writeFileSync(file.path, updatedContent, 'utf-8');
  console.log(`✓ Updated: ${path.relative(root, file.path)}`);
  updated++;
}

console.log(`\nDone. Version bumped to ${newVersion} across ${updated} file(s).`);
console.log('Run `git add package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml && git commit -m "chore: bump version to ' + newVersion + '" && git tag -a v' + newVersion + ' -m "v' + newVersion + '"` to commit and tag.');
