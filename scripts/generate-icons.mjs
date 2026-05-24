#!/usr/bin/env node
/**
 * Generates app icons from the Li logo rects:
 *   build/icon.ico   — always (pure Node, cross-platform)
 *   build/icon.icns  — macOS only (uses `iconutil`)
 *
 * Run once before building: node scripts/generate-icons.mjs
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Logo rects in 63×63 SVG coordinate space ──────────────────────────────
// Matches src/main/index.ts LOGO_RECTS exactly.
const LOGO_RECTS = [
  [40, 16,  8,  8], // "i" top cap
  [32, 32, 16,  8], // "i" upper step
  [40, 40, 16,  8], // "i" lower step
  [ 8, 16,  8, 24], // "l" vertical bar
  [ 8, 40, 24,  8], // "l" base
];

// ── Colours ────────────────────────────────────────────────────────────────
const BG = [5, 6, 8];       // --color-ink (near-black)
const FG = [255, 255, 255]; // white logo

// ── Minimal PNG encoder ───────────────────────────────────────────────────
function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const crc = crc32(Buffer.concat([typeBytes, data]));
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([len, typeBytes, data, crcBuf]);
}

function makePng(size) {
  const [br, bg, bb] = BG;
  const [fr, fg, fb] = FG;

  // Fill canvas with background colour
  const rgba = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    rgba[i * 4 + 0] = br;
    rgba[i * 4 + 1] = bg;
    rgba[i * 4 + 2] = bb;
    rgba[i * 4 + 3] = 255;
  }

  // Paint logo rects, centred with 15 % padding each side
  const padding = Math.round(size * 0.15);
  const svgPx   = size - padding * 2;   // SVG rendered within this square
  const scale   = svgPx / 63;

  for (const [rx, ry, rw, rh] of LOGO_RECTS) {
    const x0 = Math.round(padding + rx * scale);
    const y0 = Math.round(padding + ry * scale);
    const x1 = Math.max(x0 + 1, Math.round(padding + (rx + rw) * scale));
    const y1 = Math.max(y0 + 1, Math.round(padding + (ry + rh) * scale));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const idx = (y * size + x) * 4;
        rgba[idx + 0] = fr;
        rgba[idx + 1] = fg;
        rgba[idx + 2] = fb;
        rgba[idx + 3] = 255;
      }
    }
  }

  // Encode as PNG
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA

  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0; // filter byte = None
    rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(rows)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(join(ROOT, 'build'), { recursive: true });

// ── Write build/icon.ico (Windows) ────────────────────────────────────────
// ICO container = ICONDIR header + N ICONDIRENTRYs + N image blobs.
// PNGs embedded inside ICO are supported on Vista+ (electron-builder requires this).
const ICO_SIZES = [16, 32, 48, 64, 128, 256];

const icoImages = ICO_SIZES.map((size) => ({ size, png: makePng(size) }));

const iconDir = Buffer.alloc(6);
iconDir.writeUInt16LE(0, 0);              // reserved
iconDir.writeUInt16LE(1, 2);              // type = 1 (icon)
iconDir.writeUInt16LE(icoImages.length, 4); // image count

const entries = Buffer.alloc(16 * icoImages.length);
let imageOffset = iconDir.length + entries.length;
for (let i = 0; i < icoImages.length; i++) {
  const { size, png } = icoImages[i];
  const off = i * 16;
  entries[off + 0] = size >= 256 ? 0 : size;     // width  (0 means 256)
  entries[off + 1] = size >= 256 ? 0 : size;     // height (0 means 256)
  entries[off + 2] = 0;                          // colour palette count
  entries[off + 3] = 0;                          // reserved
  entries.writeUInt16LE(1,  off + 4);            // colour planes
  entries.writeUInt16LE(32, off + 6);            // bits per pixel
  entries.writeUInt32LE(png.length, off + 8);    // bytes in image data
  entries.writeUInt32LE(imageOffset, off + 12);  // offset to image data
  imageOffset += png.length;
}

const ico = Buffer.concat([iconDir, entries, ...icoImages.map((i) => i.png)]);
const icoPath = join(ROOT, 'build', 'icon.ico');
writeFileSync(icoPath, ico);
console.log(`  ✓  build/icon.ico            ${ICO_SIZES.join(', ')}`);

// ── Write build/icon.icns (macOS only) ────────────────────────────────────
if (process.platform === 'darwin') {
  const iconsetDir = join(ROOT, 'build', 'icon.iconset');
  mkdirSync(iconsetDir, { recursive: true });

  // macOS requires exactly these filenames
  const ICNS_SIZES = [
    [16,   'icon_16x16.png'],
    [32,   'icon_16x16@2x.png'],
    [32,   'icon_32x32.png'],
    [64,   'icon_32x32@2x.png'],
    [128,  'icon_128x128.png'],
    [256,  'icon_128x128@2x.png'],
    [256,  'icon_256x256.png'],
    [512,  'icon_256x256@2x.png'],
    [512,  'icon_512x512.png'],
    [1024, 'icon_512x512@2x.png'],
  ];

  for (const [size, name] of ICNS_SIZES) {
    writeFileSync(join(iconsetDir, name), makePng(size));
    console.log(`  ✓  ${name.padEnd(26)} ${size}×${size}`);
  }

  const icnsPath = join(ROOT, 'build', 'icon.icns');
  execSync(`iconutil -c icns "${iconsetDir}" -o "${icnsPath}"`);
  console.log(`\n  ✓  build/icon.icns ready`);
} else {
  console.log('\n  (skipping icon.icns — macOS only)');
}
