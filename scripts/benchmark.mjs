import { performance } from 'node:perf_hooks';
import { buildStudy } from '../src/study.js';

const width = Number(process.argv[2] || 800), height = Math.round(width * 0.75);
if (!Number.isInteger(width) || width < 16 || width > 4000) throw new Error('Use a width between 16 and 4000 pixels.');
const pixels = new Uint8ClampedArray(width * height * 4);
for (let i = 0; i < width * height; i++) pixels.set([(i * 17) % 256, (i * 31) % 256, (i * 53) % 256, 255], i * 4);
const rows = [];
for (const settings of [{ mode: 'value', levels: 4, median: 3 }, { mode: 'color', median: 3 }, { mode: 'color', median: 3, palette: 8 }, { mode: 'chroma', median: 3 }]) {
  const start = performance.now();
  const result = buildStudy(pixels, width, height, settings);
  rows.push({ ...settings, milliseconds: Math.round(performance.now() - start), outputBytes: result.output.byteLength, processRSSMiB: Math.round(process.memoryUsage().rss / 1024 / 1024) });
}
console.log(JSON.stringify({ environment: `Node ${process.version}, ${process.platform}/${process.arch}`, width, height, note: 'Synthetic desktop benchmark. RSS includes the Node process and garbage awaiting collection. This is not a phone or browser measurement.', results: rows }, null, 2));
