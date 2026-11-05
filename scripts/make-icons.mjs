// Uygulama simgelerini (PNG) bagimliliksiz uretir: yesil zemin uzerinde beyaz halka grafik.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [15, 118, 110];
const WHITE = [255, 255, 255];
const SOFT = [153, 246, 228];

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

// Birim kare (0..1) icinde bir noktanin rengi
function shade(u, v) {
  const dx = u - 0.5;
  const dy = v - 0.5;
  const r = Math.hypot(dx, dy);
  if (r < 0.17 || r > 0.31) return BG;
  // Saat 12'den saat yonunde aci (0..1)
  let a = Math.atan2(dx, -dy) / (2 * Math.PI);
  if (a < 0) a += 1;
  const gaps = [0, 0.62, 0.84]; // dilim sinirlari
  for (const g of gaps) {
    const d = Math.min(Math.abs(a - g), 1 - Math.abs(a - g)) * 2 * Math.PI * r;
    if (d < 0.012) return BG;
  }
  if (a < 0.62) return WHITE;
  if (a < 0.84) return SOFT;
  return [94, 234, 212];
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
