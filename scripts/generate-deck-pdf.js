const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const sharp = require('sharp')

const rootDir = path.resolve(__dirname, '..')
const htmlPath = path.join(rootDir, 'Phola_Presentation_Deck.html')
const standaloneHtmlPath = path.join(rootDir, 'Phola_Presentation_Deck_standalone.html')
const pdfPath = path.join(rootDir, 'Phola_Presentation_Deck.pdf')

async function main() {
  console.log('[pdf] Reading HTML presentation template...')
  let html = fs.readFileSync(htmlPath, 'utf8')

  // Optimize and embed all screenshots as ultra-fast DCTDecode JPEGs
  console.log('[pdf] Optimizing screenshots with sharp and inlining as base64...')
  const matches = [...html.matchAll(/src="assets\/screenshots\/([^"]+)"/g)]
  for (const m of matches) {
    const filename = m[1]
    const filePath = path.join(rootDir, 'assets', 'screenshots', filename)
    if (fs.existsSync(filePath)) {
      const origBuf = fs.readFileSync(filePath)
      // Compress to high-quality progressive JPEG at max width 960px
      const optBuf = await sharp(origBuf)
        .resize({ width: 960, withoutEnlargement: true })
        .jpeg({ quality: 86, progressive: true, mozjpeg: true })
        .toBuffer()
      const b64 = optBuf.toString('base64')
      html = html.replace(m[0], `src="data:image/jpeg;base64,${b64}"`)
      console.log(`  + Embedded ${filename} (${(origBuf.length / 1024).toFixed(1)} KB -> ${(optBuf.length / 1024).toFixed(1)} KB)`)
    } else {
      console.warn(`  ! File not found: ${filePath}`)
    }
  }

  // Replace external Google font import with local system font fallbacks to prevent network timeout
  html = html.replace(/@import url\('[^']+'\);/g, '')

  fs.writeFileSync(standaloneHtmlPath, html, 'utf8')
  console.log(`[pdf] Standalone HTML created: ${(fs.statSync(standaloneHtmlPath).size / 1024 / 1024).toFixed(2)} MB`)

  // Try compiling with Microsoft Edge headless
  const edgeCandidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ]

  const edgePath = edgeCandidates.find((p) => fs.existsSync(p))

  if (!edgePath) {
    console.error('[pdf] Microsoft Edge not found!')
    process.exit(1)
  }

  console.log(`[pdf] Compiling fast vector PDF using Edge at: ${edgePath}...`)
  if (fs.existsSync(pdfPath)) {
    try {
      fs.unlinkSync(pdfPath)
    } catch (err) {
      console.warn('[pdf] Could not delete existing PDF (might be open):', err.message)
    }
  }

  try {
    const cmd = `"${edgePath}" --headless --disable-gpu --allow-file-access-from-files --print-to-pdf="${pdfPath}" --no-pdf-header-footer "${standaloneHtmlPath}"`
    execSync(cmd, { stdio: 'inherit', timeout: 30000 })
    if (fs.existsSync(pdfPath)) {
      const stats = fs.statSync(pdfPath)
      console.log(`\n============================================================`)
      console.log(`[pdf] SUCCESS! Fast Loading PDF: ${pdfPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`)
      console.log(`============================================================`)
    } else {
      console.error('[pdf] Failed to produce PDF file.')
      process.exit(1)
    }
  } catch (error) {
    console.error('[pdf] Compilation error:', error.message)
    process.exit(1)
  }
}

main()
