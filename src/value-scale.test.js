import test from 'node:test';
import assert from 'node:assert/strict';
import { valueToLuminance, luminanceToValue, samplePhotoValue, valueScale, nearestValueStep } from './value-scale.js';

test('Munsell conversion matches reference luminance and black and white endpoints', () => {
  assert.ok(Math.abs(valueToLuminance(4.08244375) - 0.122363426) < 1e-8);
  assert.equal(luminanceToValue(0), 0);
  assert.equal(luminanceToValue(1), 10);
  for (let value = 0; value < 10; value += 0.1) {
    assert.ok(Math.abs(luminanceToValue(valueToLuminance(value)) - value) < 1e-7);
  }
});

test('photo value linearizes sRGB and averages light rather than encoded bytes', () => {
  const gray = samplePhotoValue(Uint8ClampedArray.of(128, 128, 128, 255), 1, 1, 0, 0);
  assert.ok(gray > 5 && gray < 5.5);
  const mixed = samplePhotoValue(Uint8ClampedArray.of(0, 0, 0, 255, 255, 255, 255, 255), 2, 1, 0, 0);
  assert.ok(mixed > 7 && mixed < 8);
  assert.equal(samplePhotoValue(Uint8ClampedArray.of(0, 0, 0, 0), 1, 1, 0, 0), 10);
  assert.equal(samplePhotoValue(Uint8ClampedArray.of(0, 0, 0, 255), 1, 1, -10, 30), 0);
  const edge = Uint8ClampedArray.from([0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255]);
  assert.equal(samplePhotoValue(edge, 6, 1, 0, 0), 0);
  assert.equal(samplePhotoValue(edge, 6, 1, 5, 0), 10);
});

test('scale size changes representatives without changing their 0–10 range', () => {
  for (const count of [5, 10, 11]) {
    const scale = valueScale(count);
    assert.equal(scale.length, count);
    assert.deepEqual(scale[0], { value: 0, gray: 0 });
    assert.deepEqual(scale.at(-1), { value: 10, gray: 255 });
    for (let i = 1; i < count; i++) assert.ok(scale[i].gray > scale[i - 1].gray);
    assert.equal(nearestValueStep(-1, count), 0);
    assert.equal(nearestValueStep(11, count), count - 1);
  }
  assert.equal(valueScale(11)[5].gray, 121);
  assert.equal(nearestValueStep(5.2, 11), 5);
  assert.throws(() => valueScale(1), RangeError);
});
