const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makePng(size, bgHex, drawCow) {
  const bg = [
    parseInt(bgHex.slice(1, 3), 16),
    parseInt(bgHex.slice(3, 5), 16),
    parseInt(bgHex.slice(5, 7), 16),
  ];

  const raw = Buffer.alloc((size * 3 + 1) * size);
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.32;

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 3 + 1);
    raw[rowStart] = 0; // filter type none
    for (let x = 0; x < size; x++) {
      const idx = rowStart + 1 + x * 3;
      const dx = x - cx;
      const dy = y - cy;
      const insideCircle = dx * dx + dy * dy <= r * r;
      if (insideCircle) {
        raw[idx] = 255;
        raw[idx + 1] = 255;
        raw[idx + 2] = 255;
      } else {
        raw[idx] = bg[0];
        raw[idx + 1] = bg[1];
        raw[idx + 2] = bg[2];
      }
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(raw);
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return png;
}

const outDir = path.join(__dirname, 'icons');
fs.mkdirSync(outDir, { recursive: true });

const TERRACOTTA = '#c67139';

for (const size of [192, 512, 180]) {
  const png = makePng(size, TERRACOTTA);
  const name = size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`;
  fs.writeFileSync(path.join(outDir, name), png);
  console.log('wrote', name, png.length, 'bytes');
}
