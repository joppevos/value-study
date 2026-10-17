import { luminance, describeColor, adjustChroma } from './color.js';
import { defaultBoundaries, medianFilter, valueGroup } from './process.js';

export const studyDefaults = {
  mode: 'value', levels: 0, brightness: 0, contrast: 0, median: 0,
  smoothing: 'source', palette: 0, chroma: 0, flip: false, rotation: 0,
  cropLeft: 0, cropTop: 0, cropRight: 100, cropBottom: 100, groupGrays: {},
};

export function transformImage(data, width, height, settings) {
  const left = Math.min(width - 1, Math.floor(width * (settings.cropLeft ?? 0) / 100));
  const top = Math.min(height - 1, Math.floor(height * (settings.cropTop ?? 0) / 100));
  const right = Math.max(left + 1, Math.min(width, Math.ceil(width * (settings.cropRight ?? 100) / 100)));
  const bottom = Math.max(top + 1, Math.min(height, Math.ceil(height * (settings.cropBottom ?? 100) / 100)));
  const w = right - left, h = bottom - top;
  const turns = ((settings.rotation ?? 0) % 4 + 4) % 4;
  const outWidth = turns % 2 ? h : w, outHeight = turns % 2 ? w : h;
  const output = new Uint8ClampedArray(outWidth * outHeight * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let dx = x, dy = y;
    if (turns === 1) { dx = h - 1 - y; dy = x; }
    if (turns === 2) { dx = w - 1 - x; dy = h - 1 - y; }
    if (turns === 3) { dx = y; dy = w - 1 - x; }
    if (settings.flip) dx = outWidth - 1 - dx;
    const from = ((y + top) * width + x + left) * 4, to = (dy * outWidth + dx) * 4;
    const alpha = data[from + 3] / 255;
    for (let c = 0; c < 3; c++) output[to + c] = data[from + c] * alpha + 255 * (1 - alpha);
    output[to + 3] = 255;
  }
  return { data: output, width: outWidth, height: outHeight };
}

// Select a neighbor at the middle grayscale rank. Linked lists of pixel
// indices keep each sliding neighborhood searchable without scanning its area.
export function sourceMedian(data, width, height, radius) {
  if (!radius) return data;
  const values = Uint8ClampedArray.from({ length: width * height }, (_, i) => luminance(...data.subarray(i * 4, i * 4 + 3)));
  const medians = medianFilter(values, width, height, radius);
  const result = new Uint8ClampedArray(data.length);
  const heads = new Int32Array(256), next = new Int32Array(width * height), previous = new Int32Array(width * height);
  function add(i) {
    const value = values[i], head = heads[value];
    previous[i] = -1; next[i] = head;
    if (head >= 0) previous[head] = i;
    heads[value] = i;
  }
  function remove(i) {
    const before = previous[i], after = next[i];
    if (before < 0) heads[values[i]] = after; else next[before] = after;
    if (after >= 0) previous[after] = before;
  }
  for (let y = 0; y < height; y++) {
    heads.fill(-1);
    const top = Math.max(0, y - radius), bottom = Math.min(height - 1, y + radius);
    for (let yy = top; yy <= bottom; yy++) for (let xx = 0; xx <= Math.min(width - 1, radius); xx++) add(yy * width + xx);
    for (let x = 0; x < width; x++) {
      const i = y * width + x, chosen = heads[medians[i]];
      result.set(data.subarray(chosen * 4, chosen * 4 + 4), i * 4);
      for (let yy = top; yy <= bottom; yy++) {
        if (x - radius >= 0) remove(yy * width + x - radius);
        if (x + radius + 1 < width) add(yy * width + x + radius + 1);
      }
    }
  }
  return result;
}

function lab(rgb) {
  const c = describeColor(rgb), angle = (c.hue ?? 0) * Math.PI / 180;
  return [c.lightness / 100, c.chroma * Math.cos(angle), c.chroma * Math.sin(angle)];
}
const distance = (a, b) => a.reduce((sum, value, i) => sum + (value - b[i]) ** 2, 0);

// A bounded RGB histogram keeps the calculation independent of image size.
// Each bucket uses the source color nearest its population mean, never its first
// pixel. Median-cut seeds are refined by weighted perceptual cluster error.
export function reducePalette(data, size) {
  if (size < 2) return { output: data, palette: [] };
  const bins = new Map();
  for (let i = 0; i < data.length; i += 4) {
    const key = (data[i] >> 3) * 1024 + (data[i + 1] >> 3) * 32 + (data[i + 2] >> 3);
    let bin = bins.get(key);
    if (!bin) {
      bin = { key, count: 0, sum: [0, 0, 0], rgb: null, error: Infinity };
      bins.set(key, bin);
    }
    bin.count++;
    for (let c = 0; c < 3; c++) bin.sum[c] += data[i + c];
  }
  for (const bin of bins.values()) bin.mean = bin.sum.map(v => v / bin.count);
  for (let i = 0; i < data.length; i += 4) {
    const key = (data[i] >> 3) * 1024 + (data[i + 1] >> 3) * 32 + (data[i + 2] >> 3);
    const bin = bins.get(key);
    const error = bin.mean.reduce((sum, value, c) => sum + (data[i + c] - value) ** 2, 0);
    const packed = data[i] * 65536 + data[i + 1] * 256 + data[i + 2];
    if (error < bin.error || (error === bin.error && packed < bin.packed)) {
      bin.error = error; bin.packed = packed; bin.rgb = [...data.subarray(i, i + 3)];
    }
  }
  for (const bin of bins.values()) bin.lab = lab(bin.rgb);
  // Stable order and tie breaks make the palette independent of pixel ordering.
  const points = [...bins.values()].sort((a, b) => a.key - b.key);
  const boxes = [points.slice()];
  const stats = box => {
    const ranges = [0, 1, 2].map(c => {
      let min = Infinity, max = -Infinity;
      for (const p of box) { min = Math.min(min, p.lab[c]); max = Math.max(max, p.lab[c]); }
      return max - min;
    });
    const axis = ranges.indexOf(Math.max(...ranges));
    return { axis, score: ranges[axis] * box.reduce((sum, p) => sum + p.count, 0) };
  };
  while (boxes.length < size) {
    let index = -1, best = -1;
    boxes.forEach((box, i) => { const score = box.length > 1 ? stats(box).score : -1; if (score > best) { best = score; index = i; } });
    if (index < 0) break;
    const box = boxes[index], { axis } = stats(box);
    box.sort((a, b) => a.lab[axis] - b.lab[axis]);
    const half = box.reduce((sum, p) => sum + p.count, 0) / 2;
    let count = 0, split = 1;
    for (; split < box.length; split++) { count += box[split - 1].count; if (count >= half) break; }
    split = Math.min(split, box.length - 1);
    boxes.splice(index, 1, box.slice(0, split), box.slice(split));
  }
  let representatives = boxes.map(box => {
    const count = box.reduce((sum, p) => sum + p.count, 0);
    const mean = [0, 1, 2].map(c => box.reduce((sum, p) => sum + p.lab[c] * p.count, 0) / count);
    return box.reduce((best, p) => distance(p.lab, mean) < distance(best.lab, mean) ? p : best);
  });
  for (let iteration = 0; iteration < 12; iteration++) {
    const clusters = representatives.map(() => []);
    for (const point of points) {
      let nearest = 0, error = Infinity;
      representatives.forEach((representative, i) => {
        const next = distance(point.lab, representative.lab);
        if (next < error) { nearest = i; error = next; }
      });
      clusters[nearest].push(point);
    }
    const next = clusters.map((cluster, i) => {
      if (!cluster.length) return representatives[i];
      const count = cluster.reduce((sum, p) => sum + p.count, 0);
      const mean = [0, 1, 2].map(c => cluster.reduce((sum, p) => sum + p.lab[c] * p.count, 0) / count);
      return cluster.reduce((best, p) => distance(p.lab, mean) < distance(best.lab, mean) ? p : best);
    });
    if (next.every((point, i) => point === representatives[i])) break;
    representatives = next;
  }
  const lookup = new Map();
  for (const p of bins.values()) lookup.set(p.key, representatives.reduce((best, r) => distance(p.lab, r.lab) < distance(p.lab, best.lab) ? r : best).rgb);
  const output = new Uint8ClampedArray(data.length), counts = new Map();
  for (let i = 0; i < data.length; i += 4) {
    const key = (data[i] >> 3) * 1024 + (data[i + 1] >> 3) * 32 + (data[i + 2] >> 3);
    const rgb = lookup.get(key);
    output.set([...rgb, 255], i);
    const hex = describeHex(rgb); counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  return { output, palette: [...counts].map(([hex, count]) => ({ hex, count })).sort((a, b) => b.count - a.count || a.hex.localeCompare(b.hex)) };
}
const describeHex = rgb => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');

export function buildStudy(pixels, width, height, configuration, options = {}) {
  const settings = { ...studyDefaults, ...configuration };
  const original = transformImage(pixels, width, height, settings);
  width = original.width; height = original.height;
  let adjusted = new Uint8ClampedArray(original.data);
  const contrast = 1 + settings.contrast / 100;
  for (let i = 0; i < adjusted.length; i += 4) for (let c = 0; c < 3; c++) adjusted[i + c] = (adjusted[i + c] - 127.5) * contrast + 127.5 + settings.brightness * 2.55;
  let values, gamutCount = 0, palette = [];
  if (settings.mode === 'value') {
    values = Uint8ClampedArray.from({ length: width * height }, (_, i) => (luminance(...original.data.subarray(i * 4, i * 4 + 3)) - 127.5) * contrast + 127.5 + settings.brightness * 2.55);
    values = medianFilter(values, width, height, settings.median);
  } else {
    if (settings.smoothing === 'channels') {
      const filtered = [0, 1, 2].map(c => medianFilter(Uint8ClampedArray.from({ length: width * height }, (_, i) => adjusted[i * 4 + c]), width, height, settings.median));
      for (let i = 0; i < width * height; i++) for (let c = 0; c < 3; c++) adjusted[i * 4 + c] = filtered[c][i];
    } else adjusted = sourceMedian(adjusted, width, height, settings.median);
    if (settings.chroma) for (let i = 0; i < adjusted.length; i += 4) {
      const result = adjustChroma([...adjusted.subarray(i, i + 3)], 1 + settings.chroma / 100);
      adjusted.set(result.rgb, i); if (result.limited) gamutCount++;
    }
    values = Uint8ClampedArray.from({ length: width * height }, (_, i) => luminance(...adjusted.subarray(i * 4, i * 4 + 3)));
    if (settings.mode === 'color' && settings.palette >= 2) ({ output: adjusted, palette } = reducePalette(adjusted, settings.palette));
  }
  const histogram = new Uint32Array(256);
  for (const value of values) histogram[value]++;
  const output = new Uint8ClampedArray(adjusted);
  const groups = new Uint8Array(width * height);
  const counts = settings.mode === 'value' && settings.levels >= 2 ? Array(settings.levels).fill(0) : [];
  const boundaries = settings.boundaries ?? defaultBoundaries(settings.levels);
  const grays = settings.groupGrays?.[settings.levels];
  for (let i = 0; i < width * height; i++) {
    if (settings.mode === 'value') {
      let gray = values[i];
      if (counts.length) {
        const group = valueGroup(gray, boundaries); groups[i] = group; counts[group]++;
        gray = grays?.[group] ?? group * 255 / (settings.levels - 1);
      }
      output[i * 4] = output[i * 4 + 1] = output[i * 4 + 2] = gray;
    } else if (settings.mode === 'chroma') {
      // Fixed scale: OKLCH chroma 0 to 0.4 maps to black to white.
      const gray = Math.min(255, Math.round(describeColor([...adjusted.subarray(i * 4, i * 4 + 3)]).chroma / 0.4 * 255));
      output[i * 4] = output[i * 4 + 1] = output[i * 4 + 2] = gray;
    }
  }
  const preview = new Uint8ClampedArray(output);
  if (counts.length) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    if (options.highlightedGroup != null && groups[i] !== options.highlightedGroup) preview.set([219, 225, 209, 255], i * 4);
    else if (options.outlines && ((x > 0 && groups[i - 1] !== groups[i]) || (y > 0 && groups[i - width] !== groups[i]))) {
      const ink = output[i * 4] > 127 ? 0 : 255; preview.set([ink, ink, ink, 255], i * 4);
    }
  }
  return { width, height, original: original.data, output, preview, histogram, groups, counts, palette, gamutCount };
}
