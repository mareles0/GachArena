const fs = require('fs');
const path = require('path');

const base = path.join(__dirname, '..', 'src', 'assets', 'backgrounds');
const out = path.join(base, 'index.json');

function isMediaFile(name) {
  const ext = name.split('.').pop().toLowerCase();
  return ['png','jpg','jpeg','gif','webp','svg','mp4','webm'].includes(ext);
}

function readFiles() {
  const items = fs.readdirSync(base, { withFileTypes: true });
  const files = items.filter(i=>i.isFile()).map(f=>f.name).filter(isMediaFile).sort();
  return files.map(f => path.posix.join('assets/backgrounds', f));
}

const idx = readFiles();
fs.writeFileSync(out, JSON.stringify(idx, null, 2), 'utf8');
console.log('Generated backgrounds index.json with', idx.length, 'entries');
