const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const publicDir = path.join(__dirname, '..', 'public')

const sources = [
  'phola-icon.svg',
  'phola_app_icon.svg',
]

async function run() {
  for (const src of sources) {
    const inPath = path.join(publicDir, src)
    if (!fs.existsSync(inPath)) {
      console.warn('Skipping missing', inPath)
      continue
    }

    const base = path.basename(src, path.extname(src)).replace(/[^a-z0-9_-]/gi, '-')
    const out192 = path.join(publicDir, `${base}-192x192.png`)
    const out512 = path.join(publicDir, `${base}-512x512.png`)

    try {
      await sharp(inPath).resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(out192)
      console.log('Written', out192)
      await sharp(inPath).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(out512)
      console.log('Written', out512)
    } catch (err) {
      console.error('Error converting', inPath, err)
    }
  }
}

run().catch(err => { console.error(err); process.exit(1) })
