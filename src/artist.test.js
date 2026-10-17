import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultBoundaries, valueGroup, groupCounts, processImage } from './process.js';
import { describeColor, sampleArea, compareColors } from './color.js';

const defaults = { mode: 'value', brightness: 0, contrast: 0, median: 0, levels: 0 };

test('default boundaries match nearest-value rounding at every input value', () => {
  for (const levels of [2, 3, 4, 5, 7]) {
    const boundaries = defaultBoundaries(levels);
    assert.equal(boundaries.length, levels - 1);
    for (let value = 0; value < 256; value++) {
      assert.equal(valueGroup(value, boundaries), Math.round(value / 255 * (levels - 1)));
    }
  }
});

test('custom boundaries include the cutoff in the lighter group', () => {
  const pixels = Uint8ClampedArray.from([29, 30, 99, 100].flatMap(value => [value, value, value, 255]));
  const output = processImage(pixels, 4, 1, { ...defaults, levels: 3, boundaries: [30, 100] });
  assert.deepEqual([output[0], output[4], output[8], output[12]], [0, 128, 128, 255]);
  assert.deepEqual(groupCounts(output, 3), [1, 2, 1]);
  assert.deepEqual(groupCounts(output, 0), []);
});

test('color mode preserves opaque input and ignores saved value groups', () => {
  const pixels = new Uint8ClampedArray([240, 70, 15, 255, 60, 130, 210, 255]);
  const output = processImage(pixels, 2, 1, { ...defaults, mode: 'color', levels: 2, boundaries: [100] });
  assert.deepEqual(output, pixels);
});

test('color median filters all three channels and removes isolated color noise', () => {
  const pixels = new Uint8ClampedArray(3 * 3 * 4);
  for (let i = 0; i < 9; i++) pixels.set(i === 4 ? [255, 0, 255, 255] : [30, 140, 80, 255], i * 4);
  const output = processImage(pixels, 3, 3, { ...defaults, mode: 'color', median: 1 });
  assert.deepEqual([...output.slice(16, 20)], [30, 140, 80, 255]);
});

test('color mode composites transparency and clamps adjustments', () => {
  const pixels = new Uint8ClampedArray([0, 0, 0, 0, 100, 150, 200, 255]);
  const composited = processImage(pixels, 2, 1, { ...defaults, mode: 'color' });
  assert.deepEqual([...composited.slice(0, 4)], [255, 255, 255, 255]);
  const bright = processImage(pixels, 2, 1, { ...defaults, mode: 'color', brightness: 100 });
  assert.deepEqual([...bright], [255, 255, 255, 255, 255, 255, 255, 255]);
});

test('neutral colors have no hue and nearly zero OKLCH chroma', () => {
  for (const value of [0, 64, 128, 255]) {
    const color = describeColor([value, value, value]);
    assert.equal(color.hue, null);
    assert.ok(color.chroma < 0.000001);
    assert.ok(Math.abs(color.value - value / 255 * 100) < 0.00001);
  }
});

test('OKLCH reference colors match published primary values', () => {
  const red = describeColor([255, 0, 0]);
  assert.ok(Math.abs(red.lightness - 62.7955) < 0.001);
  assert.ok(Math.abs(red.chroma - 0.257683) < 0.00001);
  assert.ok(Math.abs(red.hue - 29.2339) < 0.001);
  const blue = describeColor([0, 0, 255]);
  assert.ok(Math.abs(blue.hue - 264.052) < 0.001);
  assert.equal(red.hex, '#ff0000');
});

test('area sampling averages neighbors and clips at image boundaries', () => {
  const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);
  assert.deepEqual(sampleArea(pixels, 3, 1, 0, 0, 1).rgb, [128, 0, 128]);
  assert.deepEqual(sampleArea(pixels, 3, 1, 2, 0, 0).rgb, [255, 255, 255]);
  assert.deepEqual(sampleArea(new Uint8ClampedArray([0, 0, 0, 0]), 1, 1, 0, 0).rgb, [255, 255, 255]);
});

test('comparison describes value, chroma, and shortest hue distance', () => {
  const first = { value: 50, chroma: 0.15, hue: 350 };
  const second = { value: 30, chroma: 0.05, hue: 10 };
  assert.match(compareColors(first, second), /20 value points darker/);
  assert.match(compareColors(first, second), /more muted/);
  assert.match(compareColors(first, second), /20° apart/);
  assert.doesNotMatch(compareColors(first, { ...second, hue: null }), /apart/);
});
