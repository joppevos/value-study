import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStudy, transformImage, sourceMedian, reducePalette, studyDefaults } from './study.js';
import { processImage, medianFilter } from './process.js';
import { luminance, describeColor, adjustChroma } from './color.js';
import { sanitizeState } from './state.js';

const pixels = colors => Uint8ClampedArray.from(colors.flatMap(rgb => [...rgb, 255]));
const red = [255, 0, 0], green = [0, 255, 0], blue = [0, 0, 255];

test('framing maps crop, quarter turns and flip to known original pixels', () => {
  const data = pixels([red, green, blue, [10, 10, 10], [20, 20, 20], [30, 30, 30]]);
  const rotated = transformImage(data, 3, 2, { rotation: 1 });
  assert.equal(rotated.width, 2); assert.equal(rotated.height, 3);
  assert.deepEqual([...rotated.data.slice(0, 8)], [10, 10, 10, 255, ...red, 255]);
  assert.deepEqual([...transformImage(data, 3, 2, { flip: true }).data.slice(0, 4)], [...blue, 255]);
  const crop = transformImage(data, 3, 2, { cropLeft: 34, cropRight: 66, cropBottom: 50 });
  assert.equal(crop.width, 1); assert.equal(crop.height, 1); assert.deepEqual([...crop.data], [...green, 255]);
  for (let rotation = 0; rotation < 4; rotation++) {
    const image = transformImage(data, 3, 2, { rotation, cropLeft: 99, cropTop: 99 });
    assert.equal(image.width, 1); assert.equal(image.height, 1);
  }
});

test('source median always selects an RGB neighbor at the middle value rank, including image edges', () => {
  const width = 7, height = 5;
  const data = pixels(Array.from({ length: width * height }, (_, i) => [(i * 79) % 256, (i * 31) % 256, (i * 17) % 256]));
  const values = Uint8ClampedArray.from({ length: width * height }, (_, i) => luminance(...data.subarray(i * 4, i * 4 + 3)));
  for (const radius of [0, 1, 2, 12]) {
    const result = sourceMedian(data, width, height, radius), medians = medianFilter(values, width, height, radius);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const rgb = [...result.subarray((y * width + x) * 4, (y * width + x) * 4 + 3)];
      assert.equal(Math.round(luminance(...rgb)), medians[y * width + x]);
      let found = false;
      for (let yy = Math.max(0, y - radius); yy <= Math.min(height - 1, y + radius); yy++) for (let xx = Math.max(0, x - radius); xx <= Math.min(width - 1, x + radius); xx++) {
        if (rgb.every((v, c) => data[(yy * width + xx) * 4 + c] === v)) found = true;
      }
      assert.ok(found);
    }
  }
});

test('palette reduction is deterministic, bounded and retains source colors', () => {
  const data = pixels([red, green, blue, red, green, blue, [0, 0, 0], [255, 255, 255]]);
  const result = reducePalette(data, 3);
  assert.ok(result.palette.length <= 3);
  assert.equal(result.palette.reduce((sum, p) => sum + p.count, 0), 8);
  assert.deepEqual(reducePalette(data, 3), result);
  const original = new Set(Array.from({ length: 8 }, (_, i) => [...data.slice(i * 4, i * 4 + 3)].join(',')));
  for (let i = 0; i < result.output.length; i += 4) assert.ok(original.has([...result.output.slice(i, i + 3)].join(',')));
  assert.equal(reducePalette(pixels([red, red]), 16).palette.length, 1);
  assert.deepEqual(reducePalette(data, 0).output, data);
});

test('worker pipeline preserves existing grayscale behavior across adjustments and group counts', () => {
  const data = pixels(Array.from({ length: 256 }, (_, i) => [i, (i * 31) % 256, (i * 7) % 256]));
  for (const levels of [0, 2, 3, 4, 5, 7]) for (const brightness of [-40, 0, 25]) {
    const settings = { ...studyDefaults, levels, brightness, median: 1 };
    assert.deepEqual(buildStudy(data, 16, 16, settings).output, processImage(data, 16, 16, settings));
  }
});

test('histogram uses adjusted and smoothed values before grouping, with exact image coverage', () => {
  const data = pixels([[0, 0, 0], [100, 100, 100], [255, 255, 255]]);
  const result = buildStudy(data, 3, 1, { levels: 2, boundaries: [120], brightness: 10 });
  assert.equal(result.histogram[26], 1); assert.equal(result.histogram[126], 1); assert.equal(result.histogram[255], 1);
  assert.deepEqual(result.counts, [1, 2]);
  assert.equal(result.histogram.reduce((a, b) => a + b, 0), 3);
});

test('custom group grays do not affect coverage or isolation, and preview overlays do not affect export', () => {
  const data = pixels([[10, 10, 10], [200, 200, 200], [20, 20, 20], [220, 220, 220]]);
  const settings = { levels: 2, groupGrays: { 2: [200, 50] } };
  const result = buildStudy(data, 2, 2, settings, { highlightedGroup: 0, outlines: true });
  assert.deepEqual(result.counts, [2, 2]);
  assert.deepEqual([...result.output.slice(0, 8)], [200, 200, 200, 255, 50, 50, 50, 255]);
  assert.deepEqual([...result.preview.slice(4, 8)], [219, 225, 209, 255]);
  assert.deepEqual(buildStudy(data, 2, 2, settings).output, result.output);
  assert.notDeepEqual(buildStudy(data, 2, 2, settings, { outlines: true }).preview, result.output);
});

test('chroma view distinguishes neutral from intense color using a fixed scale', () => {
  const result = buildStudy(pixels([[128, 128, 128], red]), 2, 1, { mode: 'chroma' });
  assert.equal(result.output[0], 0); assert.ok(result.output[4] > 150);
  assert.equal(result.output[4], result.output[5]);
});

test('chroma adjustment preserves model lightness within byte rounding and reports display limits', () => {
  for (const rgb of [[120, 100, 80], red, blue, [128, 128, 128]]) for (const factor of [0, 0.5, 1, 2]) {
    const adjusted = adjustChroma(rgb, factor);
    assert.ok(adjusted.rgb.every(v => v >= 0 && v <= 255));
    assert.ok(Math.abs(describeColor(rgb).lightness - describeColor(adjusted.rgb).lightness) < 0.3);
  }
  assert.equal(adjustChroma(red, 2).limited, true);
  const result = buildStudy(pixels([red, [120, 100, 80]]), 2, 1, { mode: 'color', chroma: 100 });
  assert.equal(result.gamutCount, 1);
});

test('palette and detail controls are independent and value mode ignores color adjustments', () => {
  const data = pixels([red, red, blue, red, red, red, green, red, red]);
  const full = buildStudy(data, 3, 3, { mode: 'color', palette: 3 });
  const smooth = buildStudy(data, 3, 3, { mode: 'color', palette: 3, median: 1 });
  assert.ok(full.palette.length > smooth.palette.length);
  assert.deepEqual(buildStudy(data, 3, 3, { palette: 3, chroma: 100 }).output, buildStudy(data, 3, 3, {}).output);
});

test('saved adjustments reject crossed boundaries, invalid ranges and malformed data', () => {
  const state = { settings: { ...studyDefaults }, boundaries: [[2, [100]]] };
  assert.equal(sanitizeState(state).boundaries[0][1][0], 100);
  assert.equal(sanitizeState({ settings: { median: 1000 } }), null);
  assert.equal(sanitizeState({ settings: { cropLeft: 90, cropRight: 10 } }), null);
  assert.equal(sanitizeState({ settings: {}, boundaries: [[3, [100, 50]]] }), null);
  assert.equal(sanitizeState({ settings: { groupGrays: { 2: [0] } } }), null);
  assert.equal(sanitizeState({ settings: { mode: 'invalid' } }), null);
  const sanitized = sanitizeState(state); sanitized.settings.groupGrays[2] = [20, 200];
  assert.deepEqual(studyDefaults.groupGrays, {});
});

test('a dominant muted green is not replaced by the first brown pixel in its color bucket', () => {
  const green = [96, 103, 96], brown = [99, 97, 96];
  const colors = [brown, ...Array.from({ length: 99 }, () => green), [32, 48, 32], [64, 80, 64], [128, 144, 128], [192, 208, 192]];
  const result = reducePalette(pixels(colors), 5);
  assert.equal(result.palette[0].hex, '#606760');
  assert.equal(result.palette[0].count, 100);
  assert.deepEqual(reducePalette(pixels([...colors].reverse()), 5).palette, result.palette);
});

test('five-color reduction retains a dominant green family across different lightnesses', () => {
  const greens = [[35, 55, 28], [60, 78, 46], [80, 98, 65], [105, 120, 88], [130, 141, 112]];
  const others = [[25, 25, 23], [70, 61, 47], [112, 103, 85], [165, 159, 143], [210, 208, 191]];
  const colors = [...greens.flatMap(rgb => Array.from({ length: 140 }, () => rgb)), ...others.flatMap(rgb => Array.from({ length: 60 }, () => rgb))];
  const result = reducePalette(pixels(colors), 5);
  let greenArea = 0;
  for (let i = 0; i < result.output.length; i += 4) {
    if (result.output[i + 1] > result.output[i] + 8 && result.output[i + 1] > result.output[i + 2] + 8) greenArea++;
  }
  assert.ok(greenArea >= 650, `Expected the main green area to remain green, got ${greenArea} of 1000 pixels`);
});

test('legacy Color studies restore as values with hidden color controls disabled', () => {
  const legacy = { settings: { mode: 'color', levels: 3, palette: 5, smoothing: 'channels', chroma: 80, brightness: 5, flip: true, cropLeft: 10 }, boundaries: [[3, [50, 180]]] };
  const restored = sanitizeState(legacy);
  assert.equal(restored.settings.mode, 'value');
  assert.equal(restored.settings.palette, 0);
  assert.equal(restored.settings.smoothing, 'source');
  assert.equal(restored.settings.chroma, 0);
  assert.equal(restored.settings.levels, 3);
  assert.equal(restored.settings.brightness, 5);
  assert.equal(restored.settings.flip, true);
  assert.equal(restored.settings.cropLeft, 10);
  assert.deepEqual(restored.boundaries.find(([level]) => level === 3)[1], [50, 180]);
  assert.equal(legacy.settings.mode, 'color');
  assert.equal(legacy.settings.palette, 5);
});
