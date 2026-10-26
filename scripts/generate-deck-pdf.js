const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const rootDir = path.resolve(__dirname, '..')
const htmlPath = path.join(rootDir, 'Phola_Presentation_Deck.html')
const standaloneHtmlPath = path.join(rootDir, 'Phola_Presentation_Deck_standalone.html')
const pdfPath = path.join(rootDir, 'Phola_Presentation_Deck.pdf')

console.log('[pdf] Reading HTML presentation template...')
let html = fs.readFileSync(htmlPath, 'utf8')

// Embed all screenshots as base64 data URIs
console.log('[pdf] Inlining screenshots as base64...')
html = html.replace(/src="assets\/screenshots\/([^"]+)"/g, (match, filename) => {
  const filePath = path.join(rootDir, 'assets', 'screenshots', filename)
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath).toString('base64')
    console.log(`  + Embedded ${filename} (${(data.length / 1024).toFixed(1)} KB base64)`)
    return `src="data:image/png;base64,${data}"`
  }
  console.warn(`  ! File not found: ${filePath}`)
  return match
})

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

console.log(`[pdf] Compiling PDF using Edge at: ${edgePath}...`)
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
    console.log(`[pdf] SUCCESS! Generated PDF: ${pdfPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`)
  } else {
    console.error('[pdf] Failed to produce PDF file.')
    process.exit(1)
  }
} catch (error) {
  console.error('[pdf] Compilation error:', error.message)
  process.exit(1)
}
