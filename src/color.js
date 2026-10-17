export function luminance(red, green, blue) {
  // Match the grayscale study. This is a weighted sRGB value, not physical luminance.
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function linear(channel) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function describeColor(rgb) {
  const [r, g, b] = rgb.map(linear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const labB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const chroma = Math.hypot(a, labB);
  return {
    rgb,
    hex: `#${rgb.map(value => Math.round(value).toString(16).padStart(2, '0')).join('')}`,
    value: luminance(...rgb) / 255 * 100,
    lightness: lightness * 100,
    chroma,
    hue: chroma < 0.002 ? null : (Math.atan2(labB, a) * 180 / Math.PI + 360) % 360,
  };
}

export function sampleArea(data, width, height, x, y, radius = 2) {
  const centerX = Math.max(0, Math.min(width - 1, Math.round(x)));
  const centerY = Math.max(0, Math.min(height - 1, Math.round(y)));
  const rgb = [0, 0, 0];
  let count = 0;
  for (let yy = Math.max(0, centerY - radius); yy <= Math.min(height - 1, centerY + radius); yy++) {
    for (let xx = Math.max(0, centerX - radius); xx <= Math.min(width - 1, centerX + radius); xx++) {
      const offset = (yy * width + xx) * 4;
      const alpha = data[offset + 3] / 255;
      for (let channel = 0; channel < 3; channel++) rgb[channel] += data[offset + channel] * alpha + 255 * (1 - alpha);
      count++;
    }
  }
  return describeColor(rgb.map(value => Math.round(value / count)));
}

export function compareColors(pinned, current) {
  const valueDifference = current.value - pinned.value;
  const chromaDifference = current.chroma - pinned.chroma;
  const statements = [];
  statements.push(Math.abs(valueDifference) < 1 ? 'B has about the same grayscale value as A.' : `B is ${Math.abs(valueDifference).toFixed(0)} value points ${valueDifference > 0 ? 'lighter' : 'darker'} than A.`);
  statements.push(Math.abs(chromaDifference) < 0.005 ? 'Their color intensity is similar.' : `B is ${chromaDifference > 0 ? 'more intense' : 'more muted'} than A.`);
  if (pinned.hue !== null && current.hue !== null) {
    const difference = Math.abs(pinned.hue - current.hue);
    statements.push(`Their hues are ${Math.round(Math.min(difference, 360 - difference))}° apart on the wheel.`);
  }
  return statements.join(' ');
}

// Inverse OKLab transform. Unclamped channels let the caller detect display limits.
export function rgbFromOklab(lightness, a, b) {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const encode = value => 255 * (value <= 0.0031308 ? 12.92 * value : 1.055 * Math.max(0, value) ** (1 / 2.4) - 0.055);
  return [encode(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    encode(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    encode(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)];
}

export function adjustChroma(rgb, factor) {
  const color = describeColor(rgb);
  const angle = (color.hue ?? 0) * Math.PI / 180;
  const target = color.chroma * factor;
  const convert = chroma => rgbFromOklab(color.lightness / 100, Math.cos(angle) * chroma, Math.sin(angle) * chroma);
  const fits = values => values.every(value => value >= -0.01 && value <= 255.01);
  let result = convert(target);
  const limited = !fits(result);
  if (limited) {
    let low = 0, high = target;
    for (let i = 0; i < 16; i++) {
      const middle = (low + high) / 2;
      if (fits(convert(middle))) low = middle; else high = middle;
    }
    result = convert(low);
  }
  return { rgb: result.map(value => Math.max(0, Math.min(255, Math.round(value)))), limited };
}
