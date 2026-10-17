import { luminance } from './color.js';

export function defaultBoundaries(levels) {
  return Array.from({ length: Math.max(0, levels - 1) }, (_, index) => Math.ceil(255 * (index + 0.5) / (levels - 1)));
}

export function valueGroup(value, boundaries) {
  let group = 0;
  while (group < boundaries.length && value >= boundaries[group]) group++;
  return group;
}

export function groupCounts(output, levels) {
  if (levels < 2) return [];
  const counts = Array(levels).fill(0);
  for (let offset = 0; offset < output.length; offset += 4) {
    counts[Math.round(output[offset] / 255 * (levels - 1))]++;
  }
  return counts;
}

export function medianFilter(values, width, height, radius) {
  if (!radius) return values;
  const result = new Uint8ClampedArray(values.length);
  const histogram = new Int32Array(256);
  for (let y = 0; y < height; y++) {
    histogram.fill(0);
    let count = 0;
    const top = Math.max(0, y - radius), bottom = Math.min(height - 1, y + radius);
    for (let yy = top; yy <= bottom; yy++) {
      for (let xx = 0; xx <= Math.min(width - 1, radius); xx++) {
        histogram[values[yy * width + xx]]++; count++;
      }
    }
    for (let x = 0; x < width; x++) {
      let sum = 0, median = 0;
      for (; median < 255; median++) {
        sum += histogram[median];
        if (sum > Math.floor(count / 2)) break;
      }
      result[y * width + x] = median;
      const remove = x - radius, add = x + radius + 1;
      for (let yy = top; yy <= bottom; yy++) {
        if (remove >= 0) { histogram[values[yy * width + remove]]--; count--; }
        if (add < width) { histogram[values[yy * width + add]]++; count++; }
      }
    }
  }
  return result;
}

export function processImage(data, width, height, settings) {
  const contrast = 1 + settings.contrast / 100;
  if (settings.mode === 'color') {
    const channels = Array.from({ length: 3 }, () => new Uint8ClampedArray(width * height));
    for (let i = 0; i < width * height; i++) {
      const offset = i * 4;
      const alpha = data[offset + 3] / 255;
      for (let channel = 0; channel < 3; channel++) {
        const value = data[offset + channel] * alpha + 255 * (1 - alpha);
        channels[channel][i] = (value - 127.5) * contrast + 127.5 + settings.brightness * 2.55;
      }
    }
    const filtered = channels.map(channel => medianFilter(channel, width, height, settings.median));
    const output = new Uint8ClampedArray(data.length);
    for (let i = 0; i < width * height; i++) {
      for (let channel = 0; channel < 3; channel++) output[i * 4 + channel] = filtered[channel][i];
      output[i * 4 + 3] = 255;
    }
    return output;
  }
  let values = new Uint8ClampedArray(width * height);
  const boundaries = settings.boundaries ?? (settings.levels === 2 ? [settings.threshold ?? 128] : defaultBoundaries(settings.levels));
  for (let i = 0; i < values.length; i++) {
    const offset = i * 4;
    // Composite transparent images onto white before computing luminance.
    const alpha = data[offset + 3] / 255;
    const gray = luminance(data[offset], data[offset + 1], data[offset + 2]) * alpha + 255 * (1 - alpha);
    values[i] = (gray - 127.5) * contrast + 127.5 + settings.brightness * 2.55;
  }
  values = medianFilter(values, width, height, settings.median);
  const output = new Uint8ClampedArray(data.length);
  for (let i = 0; i < values.length; i++) {
    let value = values[i];
    if (settings.levels >= 2) value = valueGroup(value, boundaries) * 255 / (settings.levels - 1);
    output[i * 4] = output[i * 4 + 1] = output[i * 4 + 2] = value;
    output[i * 4 + 3] = 255;
  }
  return output;
}
