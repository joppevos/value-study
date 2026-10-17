import { buildStudy } from './study.js';
self.onmessage = async ({ data }) => {
  const { id, settings, options } = data;
  try {
    let { pixels, width, height } = data;
    if (data.blob) {
      const bitmap = await createImageBitmap(data.blob);
      width = bitmap.width; height = bitmap.height;
      const canvas = new OffscreenCanvas(width, height), ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0); bitmap.close();
      pixels = ctx.getImageData(0, 0, width, height).data;
    }
    if (data.export && data.previewLongestSide && settings.median) settings.median = Math.max(1, Math.round(settings.median * Math.max(width, height) / data.previewLongestSide));
    const result = buildStudy(pixels, width, height, settings, options);
    if (data.export) {
      const canvas = new OffscreenCanvas(result.width, result.height);
      canvas.getContext('2d').putImageData(new ImageData(result.output, result.width, result.height), 0, 0);
      self.postMessage({ id, blob: await canvas.convertToBlob({ type: 'image/png' }) });
    } else {
      self.postMessage({ id, ...result }, [result.original.buffer, result.output.buffer, result.preview.buffer, result.histogram.buffer, result.groups.buffer]);
    }
  } catch (error) { self.postMessage({ id, error: error.message || 'The image could not be processed.' }); }
};
