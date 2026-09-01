// Generates real LOCUS brand assets (icon, splash, adaptive icons, favicon, Android mipmaps)
// from an authentic avionics GNSS integrity radar glyph definition.
// Run: node scripts/generate-assets.mjs
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'assets', 'images');
const resDir = path.join(root, 'android', 'app', 'src', 'main', 'res');

const BG = '#0C1116'; // panel background
const GRID = '#1A232C'; // grid hairline
const ACCENT = '#00D9A3'; // trusted emerald
const ACCENT_GLOW = 'rgba(0, 217, 163, 0.2)';
const CHROME = '#3A434D';
const WHITE = '#FFFFFF';

// Geometric LOCUS GNSS Target Reticle inside a compass-rose crosshair ring.
function locusGlyphSvg({ stroke, strokeWidth, glyphScale = 1, withRing = true, isMonochrome = false }) {
  const sw = strokeWidth;
  const ticks = [];
  if (withRing) {
    // Ring ticks every 30deg, cardinal ticks longer + thicker
    for (let deg = 0; deg < 360; deg += 30) {
      const cardinal = deg % 90 === 0;
      const r1 = cardinal ? 285 : 305;
      const r2 = 335;
      const rad = (deg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const tickColor = cardinal ? stroke : (isMonochrome ? stroke : CHROME);
      ticks.push(
        `<line x1="${(512 + cos * r1).toFixed(1)}" y1="${(512 + sin * r1).toFixed(1)}" x2="${(512 + cos * r2).toFixed(1)}" y2="${(512 + sin * r2).toFixed(1)}" stroke="${tickColor}" stroke-width="${cardinal ? sw * 1.1 : sw * 0.6}" stroke-linecap="square"/>`,
      );
    }
  }

  // Precision LOCUS reticle: concentric satellite orbital rings + diamond target beacon
  const reticle = `
    <!-- Outer ring -->
    ${withRing ? `<circle cx="512" cy="512" r="335" fill="none" stroke="${isMonochrome ? stroke : CHROME}" stroke-width="${sw * 0.5}"/>` : ''}
    <!-- Mid orbital ring -->
    <circle cx="512" cy="512" r="230" fill="none" stroke="${stroke}" stroke-width="${sw * 0.7}" stroke-dasharray="16 12"/>
    <!-- Inner lock ring -->
    <circle cx="512" cy="512" r="110" fill="none" stroke="${stroke}" stroke-width="${sw * 0.8}"/>
    
    <!-- Crosshairs -->
    <!-- Top arm -->
    <line x1="512" y1="130" x2="512" y2="210" stroke="${stroke}" stroke-width="${sw * 1.2}" stroke-linecap="square"/>
    <line x1="512" y1="250" x2="512" y2="400" stroke="${stroke}" stroke-width="${sw * 0.8}" stroke-linecap="square"/>
    <!-- Bottom arm -->
    <line x1="512" y1="894" x2="512" y2="814" stroke="${stroke}" stroke-width="${sw * 1.2}" stroke-linecap="square"/>
    <line x1="512" y1="774" x2="512" y2="624" stroke="${stroke}" stroke-width="${sw * 0.8}" stroke-linecap="square"/>
    <!-- Left arm -->
    <line x1="130" y1="512" x2="210" y2="512" stroke="${stroke}" stroke-width="${sw * 1.2}" stroke-linecap="square"/>
    <line x1="250" y1="512" x2="400" y2="512" stroke="${stroke}" stroke-width="${sw * 0.8}" stroke-linecap="square"/>
    <!-- Right arm -->
    <line x1="894" y1="512" x2="814" y2="512" stroke="${stroke}" stroke-width="${sw * 1.2}" stroke-linecap="square"/>
    <line x1="774" y1="512" x2="624" y2="512" stroke="${stroke}" stroke-width="${sw * 0.8}" stroke-linecap="square"/>

    <!-- Center diamond target (LOCUS core) -->
    <polygon points="512,460 564,512 512,564 460,512" fill="${stroke}" stroke="${stroke}" stroke-width="${sw * 0.4}"/>
    <circle cx="512" cy="512" r="18" fill="${BG}"/>
    <circle cx="512" cy="512" r="6" fill="${stroke}"/>

    <!-- 4 Satellite Constellation Orbit Points -->
    <circle cx="349" cy="349" r="14" fill="${stroke}"/>
    <circle cx="675" cy="349" r="14" fill="${stroke}"/>
    <circle cx="349" cy="675" r="14" fill="${stroke}"/>
    <circle cx="675" cy="675" r="14" fill="${stroke}"/>
  `;

  const transform =
    glyphScale === 1
      ? ''
      : ` transform="translate(${512 - 512 * glyphScale} ${512 - 512 * glyphScale}) scale(${glyphScale})"`;
  return `
    <g${transform}>
      ${ticks.join('\n')}
      ${reticle}
    </g>
  `;
}

function gridSvg() {
  const lines = [];
  for (let p = 128; p < 1024; p += 128) {
    lines.push(`<line x1="${p}" y1="0" x2="${p}" y2="1024" stroke="${GRID}" stroke-width="1.5"/>`);
    lines.push(`<line x1="0" y1="${p}" x2="1024" y2="${p}" stroke="${GRID}" stroke-width="1.5"/>`);
  }
  return lines.join('\n');
}

const iconSvg = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="${BG}"/>
  ${gridSvg()}
  ${locusGlyphSvg({ stroke: ACCENT, strokeWidth: 32, glyphScale: 0.92 })}
</svg>`;

const splashSvg = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  ${locusGlyphSvg({ stroke: ACCENT, strokeWidth: 38, glyphScale: 0.88 })}
</svg>`;

// Adaptive foreground: glyph confined to safe zone (~62%), transparent background
const foregroundSvg = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  ${locusGlyphSvg({ stroke: ACCENT, strokeWidth: 36, glyphScale: 0.62 })}
</svg>`;

const monochromeSvg = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  ${locusGlyphSvg({ stroke: WHITE, strokeWidth: 36, glyphScale: 0.62, isMonochrome: true })}
</svg>`;

const densities = [
  { name: 'mipmap-mdpi', iconSize: 48, fgSize: 108 },
  { name: 'mipmap-hdpi', iconSize: 72, fgSize: 162 },
  { name: 'mipmap-xhdpi', iconSize: 96, fgSize: 216 },
  { name: 'mipmap-xxhdpi', iconSize: 144, fgSize: 324 },
  { name: 'mipmap-xxxhdpi', iconSize: 192, fgSize: 432 },
];

async function main() {
  await mkdir(outDir, { recursive: true });

  // 1. Generate standard expo assets
  const jobs = [
    ['icon.png', iconSvg, 1024],
    ['splash-icon.png', splashSvg, 1024],
    ['android-icon-foreground.png', foregroundSvg, 1024],
    ['android-icon-monochrome.png', monochromeSvg, 1024],
    ['favicon.png', iconSvg, 48],
  ];

  for (const [name, svg, size] of jobs) {
    await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(outDir, name));
    console.log('[ASSET] wrote', name);
  }

  // Adaptive background: solid panel color
  await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: BG },
  })
    .png()
    .toFile(path.join(outDir, 'android-icon-background.png'));
  console.log('[ASSET] wrote android-icon-background.png');

  // 2. Generate native Android mipmaps for all DPI buckets
  for (const { name: folder, iconSize, fgSize } of densities) {
    const targetFolder = path.join(resDir, folder);
    await mkdir(targetFolder, { recursive: true });

    // ic_launcher.webp
    await sharp(Buffer.from(iconSvg)).resize(iconSize, iconSize).webp({ quality: 95 }).toFile(path.join(targetFolder, 'ic_launcher.webp'));

    // ic_launcher_round.webp
    await sharp(Buffer.from(iconSvg)).resize(iconSize, iconSize).webp({ quality: 95 }).toFile(path.join(targetFolder, 'ic_launcher_round.webp'));

    // ic_launcher_foreground.webp
    await sharp(Buffer.from(foregroundSvg)).resize(fgSize, fgSize).webp({ quality: 95 }).toFile(path.join(targetFolder, 'ic_launcher_foreground.webp'));

    // ic_launcher_background.webp
    await sharp({ create: { width: fgSize, height: fgSize, channels: 4, background: BG } }).webp({ quality: 95 }).toFile(path.join(targetFolder, 'ic_launcher_background.webp'));

    // ic_launcher_monochrome.webp
    await sharp(Buffer.from(monochromeSvg)).resize(fgSize, fgSize).webp({ quality: 95 }).toFile(path.join(targetFolder, 'ic_launcher_monochrome.webp'));

    console.log(`[MIPMAP] generated ${folder} icons (${iconSize}x${iconSize}, fg: ${fgSize}x${fgSize})`);
  }

  console.log('\n✓ All LOCUS icons and native Android mipmaps generated successfully!\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
