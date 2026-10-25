const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const openNextDir = path.join(rootDir, '.open-next');
const assetsDir = path.join(openNextDir, 'assets');

if (!fs.existsSync(openNextDir)) {
  console.error('[bundle-pages] Error: .open-next directory does not exist.');
  process.exit(1);
}

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// 1. Copy worker.js to assets/_worker.js (Cloudflare Pages Advanced Mode)
const workerSrc = path.join(openNextDir, 'worker.js');
const workerDest = path.join(assetsDir, '_worker.js');
if (fs.existsSync(workerSrc)) {
  fs.copyFileSync(workerSrc, workerDest);
  console.log('[bundle-pages] Copied worker.js -> assets/_worker.js');
} else {
  console.warn('[bundle-pages] Warning: worker.js not found in .open-next');
}

// 2. Copy supporting modules imported by worker.js
const subdirs = ['cloudflare', 'server-functions', 'middleware', '.build'];
for (const dir of subdirs) {
  const src = path.join(openNextDir, dir);
  const dest = path.join(assetsDir, dir);
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true });
    console.log(`[bundle-pages] Copied ${dir} -> assets/${dir}`);
  }
}

console.log('[bundle-pages] Cloudflare Pages bundle ready in .open-next/assets');
