const fs = require('fs');
const path = require('path');

const winSource = process.env.SOURCE_DIR || process.env.SRC || 'C:\\Users\\jacky\\Downloads\\Images';
const wslSource = winSource.replace(/^([A-Za-z]):\\/, (m, p1) => `/mnt/${p1.toLowerCase()}/`).replace(/\\/g, '/');
const projectRoot = path.join(__dirname, '..');
const destDir = path.join(projectRoot, 'public', 'gbv');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function isMedia(file) {
  const ext = path.extname(file).toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.mov', '.m4v', '.svg'].includes(ext);
}

function copyFrom(src) {
  if (!fs.existsSync(src)) return [];
  const files = fs.readdirSync(src).filter(isMedia);
  ensureDir(destDir);
  const copied = [];
  for (const f of files) {
    const from = path.join(src, f);
    const to = path.join(destDir, f);
    try {
      fs.copyFileSync(from, to);
      copied.push(f);
      console.log('Copied', f);
    } catch (e) {
      console.error('Failed to copy', f, e.message);
    }
  }
  return copied;
}

const copied = copyFrom(wslSource);
if (copied.length === 0) {
  console.log('No files copied from', wslSource);
  console.log('Make sure the path exists and contains images/videos. You can set SOURCE_DIR env var to override.');
} else {
  // write list.json
  const listPath = path.join(destDir, 'list.json');
  fs.writeFileSync(listPath, JSON.stringify(copied, null, 2));
  console.log('Wrote', listPath);
}

console.log('Done');
