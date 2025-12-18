const fs = require('fs');
const path = require('path');

const base = path.join(__dirname, '..', 'src', 'assets', 'avatares');
const out = path.join(base, 'index.json');

function isImageFile(name) {
  const ext = name.split('.').pop().toLowerCase();
  return ['png','jpg','jpeg','gif','webp','svg'].includes(ext);
}

function readCategories() {
  const items = fs.readdirSync(base, { withFileTypes: true });
  const cats = items.filter(i=>i.isDirectory()).map(d=>d.name);
  const result = {};
  cats.sort();
  cats.forEach(cat => {
    const dir = path.join(base, cat);
    let files = [];
    try {
      files = fs.readdirSync(dir).filter(fn=>isImageFile(fn)).sort();
    } catch (e) {
      files = [];
    }
    result[cat] = files.map(f => path.posix.join('assets/avatares', cat, f));
  });
  return result;
}

const idx = readCategories();
fs.writeFileSync(out, JSON.stringify(idx, null, 2), 'utf8');
console.log('Generated index.json with categories:', Object.keys(idx));
