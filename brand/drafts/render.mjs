// node brand/drafts/render.mjs  (from the repo root)
// Draft X headers in the redesign's look. Writes brand/drafts/*.svg + .png and
// a contact sheet (each draft with the avatar laid over it as X shows it).
// Run from the repo root.
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
const repo = process.cwd(); const require = createRequire(repo + '/package.json')
const { Resvg } = require('@resvg/resvg-js')
const out = join(repo, 'brand/drafts'); mkdirSync(out, { recursive: true })
const fonts = ['Barlow-Regular.ttf', 'Barlow-Medium.ttf', 'Barlow-SemiBold.ttf', 'BarlowSemiCondensed-Bold.ttf', 'BarlowSemiCondensed-ExtraBold.ttf'].map(f => join(repo, 'brand/fonts', f))
const photo = n => `data:image/jpeg;base64,${readFileSync(join(repo, 'public/images/sports', n + '.jpg')).toString('base64')}`
const E = 'M24 16H82L76 30H40V43H72L66 57H40V70H82L76 84H24Z'

// Shared pieces --------------------------------------------------------------
const defs = `
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0A101B"/><stop offset="1" stop-color="#060A12"/></linearGradient>
  <linearGradient id="blue" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4C9BFF"/><stop offset="1" stop-color="#38BDF8"/></linearGradient>
  <linearGradient id="blueD" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4C9BFF"/><stop offset="1" stop-color="#38BDF8"/></linearGradient>
  <radialGradient id="glowR" cx="0.82" cy="0.2" r="0.55"><stop offset="0" stop-color="#2F7BFF" stop-opacity="0.20"/><stop offset="1" stop-color="#2F7BFF" stop-opacity="0"/></radialGradient>`
const ground = `<rect width="1500" height="500" fill="url(#bg)"/><rect width="1500" height="500" fill="url(#glowR)"/>`
const grid = `<g stroke="#111A28" stroke-width="1"><path d="M0 100H1500M0 200H1500M0 300H1500M0 400H1500"/><path d="${Array.from({ length: 14 }, (_, i) => `M${(i + 1) * 100} 0V500`).join('')}"/></g>`
const topRule = `<rect width="1500" height="4" fill="url(#blue)"/>`
const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="500" viewBox="0 0 1500 500"><defs>${defs}</defs>${body}</svg>`
const url = (x, y) => `<g transform="translate(${x} ${y})"><rect width="232" height="46" rx="2" fill="#2F7BFF"/><text x="116" y="31" text-anchor="middle" font-family="Barlow" font-weight="600" font-size="21" fill="#FFFFFF">edthestatman.com</text></g>`

const drafts = {
  // 1. The arena, washed in navy. Unsplash photo (public/images/sports/cbb.jpg), no faces or logos.
  'a-arena': svg(`
    <image href="${photo('cbb')}" width="1500" height="500" preserveAspectRatio="xMidYMid slice"/>
    <linearGradient id="wash" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#060A12" stop-opacity="0.55"/><stop offset="0.45" stop-color="#060A12" stop-opacity="0.82"/><stop offset="1" stop-color="#060A12" stop-opacity="0.95"/></linearGradient>
    <rect width="1500" height="500" fill="url(#wash)"/>
    <rect width="1500" height="500" fill="#0A1A3A" fill-opacity="0.35" style="mix-blend-mode:color"/>
    ${topRule}
    <g font-family="Barlow" font-weight="600" font-size="19" fill="#6AA5FF" letter-spacing="3.5"><text x="600" y="128">EDTHESTATMAN.COM</text></g>
    <g font-family="Barlow Semi Condensed" font-weight="800" font-size="70" fill="#F2F6FB">
      <text x="596" y="204">Where handicappers get sharp</text>
      <text x="596" y="276">and bettors <tspan fill="url(#blue)">win.</tspan></text>
    </g>
    <g font-family="Barlow" font-weight="500" font-size="25" fill="#C9D4E2"><text x="600" y="332">Systems, trends and graded picks, posted daily.</text></g>
    ${url(600, 362)}`),

  // 2. A big cropped Clean E as the graphic.
  'b-big-e': svg(`
    ${ground}${grid}
    <circle cx="1270" cy="250" r="0"/>
    <svg x="1090" y="40" width="360" height="422" viewBox="24 16 58 68"><path d="${E}" fill="url(#blueD)"/></svg>
    <circle cx="1270" cy="250" r="260" fill="#2F7BFF" fill-opacity="0.07"/>
    ${topRule}
    <g font-family="Barlow" font-weight="600" font-size="19" fill="#6AA5FF" letter-spacing="3.5"><text x="64" y="118">THE RESEARCH DESK FOR SPORTS BETTORS</text></g>
    <g font-family="Barlow Semi Condensed" font-weight="800" font-size="92" fill="#F2F6FB">
      <text x="58" y="210">Bet with the</text>
      <text x="58" y="300">numbers, <tspan fill="url(#blue)">not a hunch.</tspan></text>
    </g>
    <g font-family="Barlow" font-weight="500" font-size="24" fill="#B3C0D1"><text x="500" y="356">NFL  ·  College Football  ·  NBA  ·  College Basketball</text></g>
    ${url(500, 382)}`),

  // 3. The three products as one rate-sheet strip.
  'c-three-products': svg(`
    ${ground}${grid}${topRule}
    <g font-family="Barlow" font-weight="600" font-size="19" fill="#6AA5FF" letter-spacing="3.5"><text x="460" y="96">EDTHESTATMAN.COM</text></g>
    <g font-family="Barlow Semi Condensed" font-weight="800" font-size="50" fill="#F2F6FB"><text x="456" y="154">Everything a sharp bettor needs, in one place.</text></g>
    ${[
      ['The Research Desk', 'Every game, every line,', 'every system attached.', 460, true],
      ['The Vault', 'Every system and trend,', 'yours to search.', 802, false],
      ['The Portfolio', 'The picks themselves.', 'Every play, graded.', 1144, false],
    ].map(([name, l1, l2, x, lead]) => `
      <g transform="translate(${x} 196)">
        <rect width="320" height="170" rx="2" fill="${lead ? '#111A28' : '#0D1522'}" stroke="#1F2B3D"/>
        <rect width="320" height="3" fill="${lead ? 'url(#blue)' : '#1F2B3D'}"/>
        <text x="24" y="54" font-family="Barlow Semi Condensed" font-weight="700" font-size="32" fill="#F2F6FB">${name}</text>
        <text x="24" y="100" font-family="Barlow" font-weight="500" font-size="21" fill="#B3C0D1">${l1}</text>
        <text x="24" y="130" font-family="Barlow" font-weight="500" font-size="21" fill="#B3C0D1">${l2}</text>
      </g>`).join('')}
    <g font-family="Barlow" font-weight="500" font-size="21" fill="#8C9CB1"><text x="460" y="414">NFL  ·  College Football  ·  NBA  ·  College Basketball  ·  posted daily</text></g>`),

  // 4. Lead with the free trial (the offer /win now leads with). No card needed is true: see components/TrialButton.tsx.
  'd-free-trial': svg(`
    ${ground}${grid}
    <linearGradient id="fadeIn" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.45" stop-color="#fff" stop-opacity="0.55"/><stop offset="1" stop-color="#fff" stop-opacity="0.9"/></linearGradient>
    <mask id="photoFade"><rect x="1160" width="340" height="500" fill="url(#fadeIn)"/></mask>
    <image href="${photo('nba')}" x="1160" y="0" width="340" height="500" preserveAspectRatio="xMidYMid slice" mask="url(#photoFade)"/>
    ${topRule}
    <g transform="translate(600 92)"><rect width="188" height="36" rx="18" fill="#2F7BFF"/><text x="94" y="25" text-anchor="middle" font-family="Barlow" font-weight="600" font-size="18" fill="#FFFFFF" letter-spacing="1">FREE FOR 7 DAYS</text></g>
    <g font-family="Barlow Semi Condensed" font-weight="800" font-size="66" fill="#F2F6FB">
      <text x="596" y="204">Try the Research Desk</text>
      <text x="596" y="284"><tspan fill="url(#blue)">free.</tspan> No card needed.</text>
    </g>
    <g font-family="Barlow" font-weight="500" font-size="24" fill="#B3C0D1"><text x="600" y="336">Every game, system, trend and pick for a week. Nothing to cancel.</text></g>
    ${url(600, 362)}`),
}

const avatar = readFileSync(join(repo, 'brand/x-avatar.png')).toString('base64')
const render = (s, w) => new Resvg(s, { fitTo: { mode: 'width', value: w }, font: { fontFiles: fonts, loadSystemFonts: false, defaultFontFamily: 'Barlow' } }).render().asPng()
const sheetParts = []
Object.entries(drafts).forEach(([name, s], i) => {
  writeFileSync(join(out, name + '.svg'), s)
  const png = render(s, 1500); writeFileSync(join(out, name + '.png'), png)
  const y = i * 660
  sheetParts.push(`<image href="data:image/png;base64,${png.toString('base64')}" y="${y}" width="1500" height="500"/>
    <defs><clipPath id="c${i}"><circle cx="207" cy="${y + 497}" r="167"/></clipPath></defs>
    <circle cx="207" cy="${y + 497}" r="177" fill="#000"/>
    <image href="data:image/png;base64,${avatar}" x="40" y="${y + 330}" width="334" height="334" clip-path="url(#c${i})"/>
    <text x="420" y="${y + 590}" font-family="Barlow" font-weight="600" font-size="34" fill="#FFFFFF">${i + 1}. ${name.slice(2).replace(/-/g, ' ')}</text>`)
  console.log('drafted', name)
})
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="${Object.keys(drafts).length * 660}"><rect width="100%" height="100%" fill="#000"/>${sheetParts.join('')}</svg>`
writeFileSync(join(out, 'contact-sheet.png'), new Resvg(sheet, { fitTo: { mode: 'width', value: 1500 }, font: { fontFiles: fonts, loadSystemFonts: false, defaultFontFamily: 'Barlow' } }).render().asPng())
console.log('contact sheet written')
