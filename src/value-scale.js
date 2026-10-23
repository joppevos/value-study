// Munsell value to relative luminance, ASTM D1535-08e1 polynomial.
// Reference: https://colour.readthedocs.io/en/latest/_modules/colour/colorimetry/luminance.html#luminance_ASTMD1535
// Photo estimates assume sRGB and relative white. They do not measure paint.
export function valueToLuminance(value) {
  const v = Math.max(0, Math.min(10, value));
  return Math.min(1, (1.1914 * v - 0.22533 * v ** 2 + 0.23352 * v ** 3 - 0.020484 * v ** 4 + 0.00081939 * v ** 5) / 100);
}

export function luminanceToValue(y) {
  y = Math.max(0, Math.min(1, y));
  if (y === 0) return 0;
  if (y === 1) return 10;
  let low = 0, high = 10;
  for (let i = 0; i < 32; i++) {
    const middle = (low + high) / 2;
    if (valueToLuminance(middle) < y) low = middle; else high = middle;
  }
  return (low + high) / 2;
}

function linear(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function samplePhotoValue(data, width, height, x, y, radius = 2) {
  x = Math.max(0, Math.min(width - 1, Math.round(x)));
  y = Math.max(0, Math.min(height - 1, Math.round(y)));
  let sum = 0, count = 0;
  for (let yy = Math.max(0, y - radius); yy <= Math.min(height - 1, y + radius); yy++) {
    for (let xx = Math.max(0, x - radius); xx <= Math.min(width - 1, x + radius); xx++) {
      const offset = (yy * width + xx) * 4, alpha = data[offset + 3] / 255;
      const rgb = [0, 1, 2].map(c => linear(data[offset + c] * alpha + 255 * (1 - alpha)));
      sum += 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]; count++;
    }
  }
  return luminanceToValue(sum / count);
}

export function valueScale(steps) {
  if (![5, 10, 11].includes(steps)) throw new RangeError('Choose 5, 10, or 11 swatches.');
  return Array.from({ length: steps }, (_, i) => {
    const value = i * 10 / (steps - 1), y = valueToLuminance(value);
    const gray = Math.round(255 * (y <= 0.0031308 ? 12.92 * y : 1.055 * y ** (1 / 2.4) - 0.055));
    return { value, gray };
  });
}

export function nearestValueStep(value, steps) {
  return Math.round(Math.max(0, Math.min(10, value)) / 10 * (steps - 1));
}
