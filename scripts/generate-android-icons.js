const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const srcPaths = [
  path.join(__dirname, '..', 'public', 'phola-icon.svg'),
  path.join(__dirname, '..', 'public', 'phola_app_icon-512x512.png'),
  path.join(__dirname, '..', 'public', 'phola-icon-512x512.png'),
  path.join(__dirname, '..', 'public', 'phola-icon.png'),
];

const src = srcPaths.find(p => fs.existsSync(p));
if (!src) {
  console.error('Source icon not found. Looked for:', srcPaths.join(', '));
  process.exit(1);
}

const projectRoot = path.join(__dirname, '..');
const androidRes = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');

const densities = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

async function generate() {
  for (const [folder, size] of Object.entries(densities)) {
    const outDir = path.join(androidRes, folder);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, 'ic_launcher.png');
    const outRound = path.join(outDir, 'ic_launcher_round.png');
    const outForeground = path.join(outDir, 'ic_launcher_foreground.png');
    // Render SVG or PNG source into centered, transparent PNGs
    await sharp(src, { density: 300 })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(outForeground);
    // Use same foreground for launcher and round icons
    await sharp(outForeground).toFile(outPath);
    await sharp(outForeground).toFile(outRound);
    console.log('Wrote:', outPath);
  }
  console.log('Done generating launcher icons.');
}

generate().catch(err => {
  console.error(err);
  process.exit(1);
});
