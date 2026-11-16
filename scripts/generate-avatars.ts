#!/usr/bin/env bun

// Renders square 1024px org avatars (GitHub etc.) to public/images/avatars/:
//   synthomaha-avatar-icon.png  - the patch-bay "O" from public/favicon.svg
//   synthomaha-avatar-full.png  - the full wordmark from Logo.astro
// Font: scripts/fonts/orbitron-700.ttf

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'public/images/avatars')
const BG = '#242220'
const SIZE = 1024

const font = {
    loadSystemFonts: false,
    fontFiles: [resolve(root, 'scripts/fonts/orbitron-700.ttf')],
    defaultFontFamily: 'Orbitron',
}

const wrap = (body: string) =>
    `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg"><rect width="${SIZE}" height="${SIZE}" fill="${BG}"/>${body}</svg>`

// Icon: favicon artwork minus its rounded-rect background, scaled to 75% so
// circular crops leave the jacks intact.
const favicon = readFileSync(resolve(root, 'public/favicon.svg'), 'utf8')
const iconInner = favicon
    .replace(/^[\s\S]*?<rect[^>]*\/>/, '')
    .replace(/<\/svg>\s*$/, '')
const iconScale = 768 / 512
const icon = wrap(
    `<g transform="translate(${(SIZE - 768) / 2},${(SIZE - 768) / 2}) scale(${iconScale})">${iconInner}</g>`,
)

// Full logo: Logo.astro svg (227x40, viewBox y starts at 2) centered, 88% wide.
const logoSvg = readFileSync(
    resolve(root, 'src/components/Logo.astro'),
    'utf8',
).match(/<svg[\s\S]*?<\/svg>/)?.[0]
if (!logoSvg) throw new Error('No <svg> block found in Logo.astro')
const logoInner = logoSvg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
const s = 900 / 227
const full = wrap(
    `<g transform="translate(${(SIZE - 900) / 2},${SIZE / 2 - 22 * s}) scale(${s})">${logoInner}</g>`,
)

mkdirSync(outDir, { recursive: true })
for (const [name, svg] of [
    ['synthomaha-avatar-icon', icon],
    ['synthomaha-avatar-full', full],
] as const) {
    const png = new Resvg(svg, { font }).render().asPng()
    const out = resolve(outDir, `${name}.png`)
    writeFileSync(out, png)
    console.log(`Written ${png.byteLength} bytes -> ${out}`)
}
