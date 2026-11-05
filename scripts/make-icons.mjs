// Uygulama simgelerini (PNG) bagimliliksiz uretir.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [28, 31, 35];
const WHITE = [250, 250, 248];
const SAGE = [140, 176, 155];
const ROSE = [206, 140, 156];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y);
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Birim kare (0..1) icinde bir noktanin rengi:
// murekkep zemin uzerinde, ana sayfadaki kategori cubugunun kucuk hali
const SEGMENTS = [
  [0.2, 0.52, WHITE],
  [0.565, 0.71, SAGE],
  [0.755, 0.83, ROSE],
];
function inPill(u, v, x0, x1, y0, y1) {
  const r = (y1 - y0) / 2;
  if (v < y0 || v > y1) return false;
  const cy = (y0 + y1) / 2;
  if (u >= x0 + r && u <= x1 - r) return true;
  const cx = u < x0 + r ? x0 + r : x1 - r;
  return Math.hypot(u - cx, v - cy) <= r;
}
function shade(u, v) {
  for (const [x0, x1, color] of SEGMENTS) if (inPill(u, v, x0, x1, 0.455, 0.545)) return color;
  return BG;
}

function render(size) {
  const S = 4; // kenar yumusatma icin alt ornekleme
  return png(size, (x, y) => {
    const acc = [0, 0, 0];
    for (let i = 0; i < S; i++)
      for (let j = 0; j < S; j++) {
        const c = shade((x + (i + 0.5) / S) / size, (y + (j + 0.5) / S) / size);
        acc[0] += c[0];
        acc[1] += c[1];
        acc[2] += c[2];
      }
    return acc.map((v) => Math.round(v / (S * S)));
  });
}

mkdirSync('public/icons', { recursive: true });
for (const [name, size] of [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['favicon.png', 64],
]) {
  writeFileSync(`public/icons/${name}`, render(size));
  console.log('yazildi', name);
}
