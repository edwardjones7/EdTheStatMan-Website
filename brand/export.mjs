// Rasterises the brand SVGs to every PNG the site and X profile use.
// Run from anywhere: `npm run brand:export` (or `node brand/export.mjs`).
//
// Fonts: resvg cannot pick an axis position out of a variable font, so the
// banner uses static instances cut from the official variable TTFs by
// brand/fonts/instance.py (Archivo wdth 72 / wght 800 for the headline, etc.).
// Only those files are loaded; system fonts are off so output is identical
// on every machine.
import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const brand = dirname(fileURLToPath(import.meta.url))
const root = join(brand, '..')
const fontFiles = [
  'Archivo-Headline.ttf',
  'Archivo-Text.ttf',
  'Archivo-Link.ttf',
  'JetBrainsMono-Label.ttf',
  'JetBrainsMono-Figure.ttf',
].map((f) => join(brand, 'fonts', f))

const E = 'M24 28 H58 V37 H35 V45.5 H54 V54.5 H35 V63 H58 V72 H24 Z'
const read = (f) => readFileSync(join(brand, f), 'utf8')
const tile = read('mark-tile.svg')

// Apple touch icon: square filled edge to edge, no transparency (iOS rounds it).
const appleTile = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="#18212A"/><path d="${E}" fill="#E9EDF0"/><rect x="65" y="28" width="11" height="44" fill="#F0B44C"/></svg>`
// Android notification badge: solid white silhouette on transparent, mark ~75% wide.
const badge = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="15 15 70 70"><path d="${E}" fill="#FFFFFF"/><rect x="65" y="28" width="11" height="44" fill="#FFFFFF"/></svg>`

function png(svg, size, out) {
  const r = new Resvg(svg, {
    fitTo: size ? { mode: 'width', value: size } : { mode: 'original' },
    font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Archivo Text' },
  })
  const img = r.render()
  writeFileSync(join(root, out), img.asPng())
  console.log(`${out}  ${img.width}x${img.height}`)
}

writeFileSync(join(root, 'app/icon.svg'), tile)
console.log('app/icon.svg')
png(read('x-avatar.svg'), 400, 'brand/x-avatar.png')
png(read('x-banner.svg'), 1500, 'brand/x-banner.png')
png(tile, 256, 'app/icon.png')
png(appleTile, 180, 'app/apple-icon.png')
png(tile, 272, 'public/logo.png')
png(tile, 192, 'public/icon-192.png')
png(badge, 96, 'public/badge-96.png')
