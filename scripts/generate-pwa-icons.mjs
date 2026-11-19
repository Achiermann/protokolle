// Generates the PWA / home-screen icons for both installable apps
// (Protokolle and Booking) from inline SVG.
// Run: node scripts/generate-pwa-icons.mjs
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const INK = '#262626';

// Glyphs are drawn on a 512 grid; `t` maps grid coords into the padded area.
const GLYPHS = {
  // Document with text lines.
  protokolle: (t, w) => `
  <path d="M${t(150)} ${t(96)} H${t(300)} L${t(370)} ${t(166)} V${t(416)} H${t(150)} Z"
        fill="#ffffff" stroke="${INK}" stroke-width="${w}" stroke-linejoin="round"/>
  <path d="M${t(300)} ${t(96)} V${t(166)} H${t(370)}" fill="none" stroke="${INK}"
        stroke-width="${w}" stroke-linejoin="round"/>
  <g stroke="${INK}" stroke-width="${w}" stroke-linecap="round">
    <line x1="${t(190)}" y1="${t(226)}" x2="${t(330)}" y2="${t(226)}"/>
    <line x1="${t(190)}" y1="${t(276)}" x2="${t(330)}" y2="${t(276)}"/>
    <line x1="${t(190)}" y1="${t(326)}" x2="${t(280)}" y2="${t(326)}"/>
  </g>`,
  // Calendar with a check mark.
  booking: (t, w) => `
  <rect x="${t(126)}" y="${t(126)}" width="${t(386) - t(126)}" height="${t(406) - t(126)}"
        rx="${w * 1.6}" fill="#ffffff" stroke="${INK}" stroke-width="${w}" stroke-linejoin="round"/>
  <g stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <line x1="${t(126)}" y1="${t(196)}" x2="${t(386)}" y2="${t(196)}"/>
    <line x1="${t(196)}" y1="${t(96)}" x2="${t(196)}" y2="${t(150)}"/>
    <line x1="${t(316)}" y1="${t(96)}" x2="${t(316)}" y2="${t(150)}"/>
    <path d="M${t(196)} ${t(296)} L${t(240)} ${t(340)} L${t(320)} ${t(256)}"/>
  </g>`,
};

const APPS = [
  { glyph: 'protokolle', bg: '#ff8a96', prefix: '' },
  { glyph: 'booking', bg: '#7fcf97', prefix: 'booking-' },
];

// `pad` shrinks the glyph so maskable icons keep it inside the 80% safe zone.
function svg(glyph, bg, pad) {
  const s = 512;
  const k = (s - pad * 2) / 512;
  const t = (v) => pad + v * k;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" fill="${bg}"/>${GLYPHS[glyph](t, 14 * k)}
</svg>`;
}

const out = new URL('../public/icons/', import.meta.url);
await mkdir(out, { recursive: true });

const SIZES = [
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['icon-maskable-512.png', 512, 64],
  ['apple-touch-icon.png', 180, 24],
];

for (const { glyph, bg, prefix } of APPS) {
  for (const [name, size, pad] of SIZES) {
    const file = prefix + name;
    await sharp(Buffer.from(svg(glyph, bg, pad)))
      .resize(size, size)
      .png()
      .toFile(fileURLToPath(new URL(file, out)));
    console.log('wrote', file);
  }
}
