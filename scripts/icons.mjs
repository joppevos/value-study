// Raster counterparts of public/icon.svg for home-screen installation.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(name, data) {
  const type = Buffer.from(name), length = Buffer.alloc(4), crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([length, type, data, crc]);
}
for (const size of [192, 512]) {
  const row = size * 4 + 1, raw = Buffer.alloc(row * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x + 0.5) / size * 192 - 96, dy = (y + 0.5) / size * 192 - 96;
    const circle = dx * dx + dy * dy <= 54 * 54;
    const color = circle ? dx < 0 ? [48, 53, 46] : [251, 251, 247] : [86, 103, 70];
    const offset = y * row + 1 + x * 4;
    raw.set([...color, 255], offset);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  writeFileSync(new URL(`../public/icon-${size}.png`, import.meta.url), Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
