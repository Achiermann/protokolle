// Generates the PWA / home-screen icons from an inline SVG.
// Run: node scripts/generate-pwa-icons.mjs
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const BG = '#ff8a96';

// Document glyph on a full-bleed background. `pad` shrinks the glyph so
// maskable icons keep it inside the 80% safe zone.
function svg(pad) {
  const s = 512;
  const g = s - pad * 2;
  const k = g / 512;
  const t = (v) => pad + v * k;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" fill="${BG}"/>
  <path d="M${t(150)} ${t(96)} H${t(300)} L${t(370)} ${t(166)} V${t(416)} H${t(150)} Z"
        fill="#ffffff" stroke="#262626" stroke-width="${14 * k}" stroke-linejoin="round"/>
  <path d="M${t(300)} ${t(96)} V${t(166)} H${t(370)}" fill="none" stroke="#262626"
        stroke-width="${14 * k}" stroke-linejoin="round"/>
  <g stroke="#262626" stroke-width="${14 * k}" stroke-linecap="round">
    <line x1="${t(190)}" y1="${t(226)}" x2="${t(330)}" y2="${t(226)}"/>
    <line x1="${t(190)}" y1="${t(276)}" x2="${t(330)}" y2="${t(276)}"/>
    <line x1="${t(190)}" y1="${t(326)}" x2="${t(280)}" y2="${t(326)}"/>
  </g>
</svg>`;
}

const out = new URL('../public/icons/', import.meta.url);
await mkdir(out, { recursive: true });

const jobs = [
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['icon-maskable-512.png', 512, 64],
  ['apple-touch-icon.png', 180, 24],
];

for (const [name, size, pad] of jobs) {
  await sharp(Buffer.from(svg(pad))).resize(size, size).png().toFile(fileURLToPath(new URL(name, out)));
  console.log('wrote', name);
}
