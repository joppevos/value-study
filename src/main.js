import './style.css';
import { defaultBoundaries } from './process.js';
import { sampleArea, compareColors } from './color.js';
import { studyDefaults } from './study.js';
import { setupWorkspace } from './workspace.js';

const defaults = studyDefaults;
let settings = { ...defaults };
let source = null, processedImage = null, requestId = 0, finishedId = 0;
let displaySource = null, previewImage = null, currentResult = null, originalFile = null;
let outlines = false;
let comparing = false, processing = false, counts = [], highlightedGroup = null;
let sampling = false, sampleSource = 'original', currentSample = null, pinnedSample = null, samplePoint = null;
const boundariesByLevel = new Map();
let worker;
const icon = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 16V4m-4 4 4-4 4 4M4 15v5h16v-5"/></svg>`;

function slider(id, label, min, max, value) {
  return `<div class="range-control"><label for="${id}">${label}<output id="${id}-value" for="${id}">${value}</output></label><input id="${id}" type="range" min="${min}" max="${max}" value="${value}"/></div>`;
}

document.querySelector('#app').innerHTML = `
<header><a class="brand" href="./"><span class="brand-mark">◐</span> still<span class="brand-sub">A VALUE & COLOR STUDY TOOL</span></a><span class="private"><i></i> On your device. Just for you.</span></header>
<main>
  <div class="intro"><div><div class="eyebrow">LESS DETAIL. MORE CLARITY.</div><h1>See the bigger picture.</h1><p>Find the light, the dark, and the colors between.</p></div><button class="button upload secondary" aria-label="Open image">${icon} Open image</button></div>
  <div class="workspace">
    <section class="stage" aria-label="Image preview">
      <div class="stage-top"><span id="image-label">YOUR NEXT STUDY</span><span id="dimensions">A fresh perspective</span></div>
      <div class="comparison-pair"><div class="viewport" id="dropzone">
        <div class="empty"><div class="empty-art" aria-hidden="true"><span></span><span></span><span></span></div><h2>Start with something you see.</h2><p>Your painting, a reference, a little inspiration.<br>Take a photo or drop an image here.</p><div class="empty-actions"><button class="button primary upload">${icon} Choose image</button><button class="button camera">Take a photo</button></div><small>JPG, PNG, WebP & other browser-supported images</small></div>
        <div class="canvas-wrap" hidden><canvas id="preview" tabindex="0" aria-label="Study preview. Enable Sample colors to inspect colors with a tap or keyboard." aria-describedby="sample-help"></canvas><span id="sample-marker" hidden aria-hidden="true"></span><svg id="grid-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg></div>
        <div id="busy" hidden>Developing your study…</div>
      </div>
      <section id="companion" class="companion" hidden aria-label="Second image"><h2 id="companion-label">Painting</h2><canvas id="companion-preview" aria-label="Second study"></canvas><p id="companion-status" role="status"></p></section></div>
      <div class="stage-bottom"><span id="status" role="status" aria-live="polite">A little distance can change how you see.</span><button id="compare" disabled>◑ Hold to see original</button></div>
      <div class="sample-toolbar"><button id="squint" class="button" disabled aria-pressed="false">Hold to squint</button><button id="sample-toggle" class="button" aria-pressed="false" disabled>⊙ Sample colors</button><span id="sample-help">Compare colors from a small area, not a single pixel.</span></div>
      <details class="workspace-tools"><summary>Compare, frame & save</summary><div id="workspace-tools"></div></details>
      <section id="sampler" class="sampler" aria-label="Color comparison" hidden>
        <div class="sample-heading"><div><h2>Look closer.</h2><p>Tap the image. Pin A, then choose B.</p></div><label class="sample-source-label" for="sample-source">Sample from<select id="sample-source"><option value="original">Original photo</option><option value="study">Processed study</option></select></label></div>
        <p class="sample-note">The preview shows your sample source while sampling. Use arrow keys to move and Enter to sample. Each sample averages up to 5 × 5 pixels.</p>
        <div class="sample-layout"><div><div id="sample-cards" class="sample-cards"></div><div class="sample-actions"><button id="pin" class="button" disabled>Pin as A</button><button id="clear-samples" class="text-button">Clear samples</button></div><p id="sample-comparison" class="sample-comparison" role="status" aria-live="polite"></p></div><div class="wheel-area"><div class="color-wheel" role="img" aria-label="Hue wheel. Marker angle shows OKLCH hue. Distance from the center shows color intensity."><div class="wheel-center"></div><span id="wheel-a" class="wheel-marker" hidden>A</span><span id="wheel-b" class="wheel-marker" hidden>B</span></div><p>Hue around the wheel.<br>Muted colors near the center.</p></div></div>
        <p class="sample-note">Value matches our grayscale view (0–100). Chroma means color intensity and uses OKLCH, a perceptual color model. Samples describe the photo, not paint mixtures.</p>
      </section>
    </section>
    <aside>
      <div class="panel-heading"><h2>Your darkroom</h2><button id="reset" disabled>Reset</button></div>
      <div class="history-controls" role="group" aria-label="Adjustment history"><button id="undo" class="button" disabled>Undo</button><button id="redo" class="button" disabled>Redo</button></div>
      <fieldset id="controls" disabled>
        <div class="segments mode-switch" id="modes" role="group" aria-label="Study view"><button data-mode="value" class="active" aria-pressed="true">◐ Value</button><button data-mode="color" aria-pressed="false">◉ Color</button><button data-mode="chroma" aria-pressed="false">Chroma</button></div>
        <section class="control-section" id="value-controls"><div class="control-title"><span class="control-name">Value range</span><span>01</span></div><p>Value means how light or dark a color appears.</p><div class="segments" id="levels" role="group" aria-label="Number of value groups">${[[0, 'Full'], [2, '2'], [3, '3'], [4, '4'], [5, '5'], [7, '7']].map(([value, label]) => `<button data-level="${value}" class="${value === 0 ? 'active' : ''}" aria-pressed="${value === 0}">${label}</button>`).join('')}</div><figure id="histogram-figure"><figcaption>Adjusted values before grouping</figcaption><svg id="histogram" viewBox="0 0 256 80" role="img" aria-label="Value histogram: dark at left, light at right"></svg></figure><div id="value-strip" class="value-strip" aria-hidden="true"></div><details id="boundary-details" hidden><summary>Adjust value boundaries</summary><p>Move each cutoff to change the size of the value areas. Cutoffs cannot cross.</p><div id="boundaries"></div><button id="even-boundaries" class="text-button">Space boundaries evenly</button></details><details id="group-gray-details" hidden><summary>Display grays & outlines</summary><p>Change group grays without moving their boundaries. Outlines appear only in the preview.</p><div id="group-grays"></div><label class="check-label"><input id="outlines" type="checkbox"/> Show group outlines</label></details><div id="group-areas" hidden><p class="group-help">Tap a group to isolate its shapes.</p><div id="group-buttons" class="group-buttons" role="group" aria-label="Value group areas"></div><button id="show-groups" class="text-button" hidden>Show all groups</button></div></section>
        <section id="color-help" class="control-section" hidden><div class="control-title"><span class="control-name">Color study</span><span>01</span></div><p>Keep the color. Reduce detail with the median filter below, then sample the larger shapes.</p><p>Value groups stay saved when you switch back.</p><label class="select-label" for="smoothing">Color smoothing<select id="smoothing"><option value="source">Select neighboring colors</option><option value="channels">Separate RGB medians</option></select></label><label class="select-label" for="palette">Color limit<select id="palette" aria-label="Color limit" aria-describedby="palette-help palette-summary"><option value="0">Full color</option><option value="3">Up to 3 colors</option><option value="5">Up to 5 colors</option><option value="8">Up to 8 colors</option><option value="12">Up to 12 colors</option><option value="16">Up to 16 colors</option></select></label><p id="palette-help">Chooses colors from the image after smoothing and adjustments. The limit reduces color count; the median radius removes small details.</p><p id="palette-summary" role="status"></p><div id="palette-swatches" class="palette-swatches" aria-label="Chosen palette and image coverage"></div></section>
        <section id="chroma-help" class="control-section" hidden><div class="control-title"><span class="control-name">Color intensity</span></div><p>Chroma means muted or intense color. Black shows neutral areas. White shows OKLCH chroma of 0.4 or higher. This is not a value view.</p></section>
        <section id="chroma-adjustment" class="control-section" hidden>${slider('chroma', 'Chroma adjustment', -100, 100, 0)}<p>Adjusts OKLCH chroma while keeping model lightness before rounding. Display limits can reduce the requested intensity.</p><p id="gamut-note" role="status"></p></section>
        <section class="control-section"><div class="control-title"><span class="control-name">Light & shadow</span><span>02</span></div>${slider('brightness', 'Brightness', -100, 100, 0)}${slider('contrast', 'Contrast', -100, 100, 0)}</section>
        <section class="control-section"><div class="control-title"><span class="control-name">Simplify the details</span><span>03</span></div><p>A median filter removes small details. In Color view, choose neighboring colors or separate RGB medians.</p>${slider('median', 'Median radius', 0, 12, 0)}<div class="range-labels"><span>Original detail</span><span>Broad shapes</span></div></section>
        <details class="control-section"><summary>Framing</summary><p>Crop edges use percentages of the original photo. Rotation follows crop. Undo restores the earlier framing.</p><div class="framing-buttons"><button id="flip" class="button" aria-pressed="false">Flip horizontally</button><button id="rotate" class="button">Rotate 90°</button></div>${slider('cropLeft', 'Left edge (%)', 0, 99, 0)}${slider('cropRight', 'Right edge (%)', 1, 100, 100)}${slider('cropTop', 'Top edge (%)', 0, 99, 0)}${slider('cropBottom', 'Bottom edge (%)', 1, 100, 100)}</details>
      </fieldset>
      <div class="export"><button id="save" class="button primary" disabled>↓ Save study</button><span id="export-help">PNG image · up to 1600 px</span></div>
    </aside>
  </div>
  <footer><span>Made for a moment of perspective.</span><span>No accounts. No uploads. Just values & color.</span></footer><p id="error" role="alert" hidden></p>
</main><input type="file" id="file" accept="image/*" hidden/><input type="file" id="camera" accept="image/*" capture="environment" hidden/>`;

const $ = (id) => document.getElementById(id);
const canvas = $('preview'), ctx = canvas.getContext('2d');

function boundaries() {
  if (!boundariesByLevel.has(settings.levels)) boundariesByLevel.set(settings.levels, defaultBoundaries(settings.levels));
  return boundariesByLevel.get(settings.levels);
}

// History stores adjustments only; image pixels stay in the existing source buffer.
const undoStack = [], redoStack = [];
let gestureStart = null;
function snapshot() {
  return { settings: structuredClone(settings), boundaries: [2, 3, 4, 5, 7].map(level => [level, [...(boundariesByLevel.get(level) ?? defaultBoundaries(level))]]) };
}
function updateHistory() {
  $('undo').disabled = !source || (!undoStack.length && !gestureStart);
  $('redo').disabled = !source || !redoStack.length || !!gestureStart;
}
function record(before) {
  if (JSON.stringify(before) !== JSON.stringify(snapshot())) {
    undoStack.push(before);
    if (undoStack.length > 100) undoStack.shift();
    redoStack.length = 0;
  }
  updateHistory();
}
function finishGesture() {
  if (!gestureStart) return;
  const before = gestureStart;
  gestureStart = null;
  record(before);
}
function restore(state) {
  settings = { ...structuredClone(defaults), ...structuredClone(state.settings) };
  boundariesByLevel.clear();
  for (const [level, cutoffs] of state.boundaries) boundariesByLevel.set(level, [...cutoffs]);
  highlightedGroup = null; counts = [];
  for (const key of ['brightness', 'contrast', 'median', 'chroma', 'cropLeft', 'cropRight', 'cropTop', 'cropBottom']) {
    $(key).value = settings[key]; $(`${key}-value`).textContent = settings[key];
  }
  clearSamples(); updateControls(); updateHistory(); render();
}
function travelHistory(backwards) {
  finishGesture();
  const from = backwards ? undoStack : redoStack;
  const to = backwards ? redoStack : undoStack;
  if (!source || !from.length) return;
  to.push(snapshot());
  restore(from.pop());
}
$('undo').onclick = () => travelHistory(true);
$('redo').onclick = () => travelHistory(false);
// Input updates the preview continuously; change commits the whole slider gesture.
$('controls').addEventListener('input', event => {
  if (!event.target.matches('input[type="range"]')) return;
  gestureStart ??= snapshot();
  updateHistory();
}, true);
$('controls').addEventListener('change', finishGesture);
$('controls').addEventListener('focusout', finishGesture);
document.addEventListener('keydown', event => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 'z') return;
  if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
  if (!source) return;
  event.preventDefault(); travelHistory(!event.shiftKey);
});

function render() {
  if (!source) return;
  workspace?.adjustmentsChanged();
  requestId++;
  if (processing) { worker.terminate(); worker = makeWorker(); }
  processing = true;
  $('busy').hidden = false;
  $('save').disabled = true;
  $('group-buttons').querySelectorAll('button').forEach(button => { button.disabled = true; });
  worker.postMessage({ id: requestId, pixels: source.data, width: source.width, height: source.height,
    settings: { ...settings, boundaries: [...boundaries()] }, options: { highlightedGroup, outlines } });
}
function receiveStudy({ data }) {
  if (data.id !== requestId) return;
  processing = false;
  if (data.error) { $('busy').hidden = true; showError(data.error); return; }
  finishedId = data.id;
  currentResult = data;
  canvas.width = data.width; canvas.height = data.height;
  displaySource = new ImageData(data.original, data.width, data.height);
  processedImage = new ImageData(data.output, data.width, data.height);
  previewImage = new ImageData(data.preview, data.width, data.height);
  counts = data.counts;
  $('dimensions').textContent = `${data.width} × ${data.height}`;
  $('busy').hidden = true; $('save').disabled = false;
  $('status').textContent = settings.mode === 'chroma' ? 'Chroma · Muted to intense.' : settings.mode === 'color' ? 'Color · Study the larger shapes.' : settings.levels ? `${settings.levels} values · Tap a group to isolate it.` : 'Grayscale · Every shade has a place.';
  $('gamut-note').textContent = data.gamutCount ? `${(data.gamutCount / (data.width * data.height) * 100).toFixed(1)}% of pixels reached the display limit. Their chroma was reduced at the same model lightness.` : 'The requested colors fit the display range.';
  $('palette-summary').textContent = data.palette.length ? `${data.palette.length} chosen colors · Percentages show image area` : 'Full color · No palette reduction';
  $('palette-swatches').innerHTML = data.palette.map(color => {
    const coverage = (color.count / (data.width * data.height) * 100).toFixed(1);
    return `<figure class="palette-color"><span style="background:${color.hex}" title="${color.hex}: ${coverage}% of image" role="img" aria-label="${color.hex}, ${coverage} percent"></span><figcaption>${coverage}%</figcaption></figure>`;
  }).join('');
  drawHistogram(); updateGroups();
  if (sampling && samplePoint) takeSample();
  draw();
}
function makeWorker() {
  const next = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  next.onmessage = receiveStudy;
  next.onerror = () => { if (worker !== next) return; processing = false; $('busy').hidden = true; showError('The image could not be processed. Try a smaller image.'); };
  return next;
}
worker = makeWorker();
function drawHistogram() {
  if (!currentResult) return;
  const max = Math.max(1, ...currentResult.histogram);
  const bars = Array.from(currentResult.histogram, (count, value) => count ? `<rect x="${value}" y="${80 - count / max * 78}" width="1" height="${count / max * 78}"/>` : '').join('');
  const lines = settings.levels >= 2 ? boundaries().map((value, i) => `<line x1="${value}" x2="${value}" y1="0" y2="80"><title>Group ${i + 1} boundary: ${value}</title></line>`).join('') : '';
  $('histogram').innerHTML = bars + lines;
}

function draw() {
  if (!source) return;
  const original = displaySource;
  if (!original) return;
  ctx.putImageData(comparing || (sampling && sampleSource === 'original') ? original : sampling ? (processedImage ?? original) : (previewImage ?? processedImage ?? original), 0, 0);
}

function showError(message) { $('error').textContent = message; $('error').hidden = false; }
let loadId = 0;
async function load(file) {
  if (!file) return;
  const currentLoad = ++loadId;
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    if (currentLoad !== loadId) return;
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    source = ctx.getImageData(0, 0, canvas.width, canvas.height);
    displaySource = source; originalFile = file; previewImage = null; currentResult = null;
    processedImage = null; counts = []; highlightedGroup = null; comparing = false;
    squint(false);
    gestureStart = null; undoStack.length = 0; redoStack.length = 0; updateHistory();
    clearSamples();
    document.querySelector('.empty').hidden = true;
    document.querySelector('.canvas-wrap').hidden = false;
    for (const id of ['controls', 'reset', 'compare', 'sample-toggle', 'squint']) $(id).disabled = false;
    $('image-label').textContent = file.name || 'YOUR PHOTO';
    $('dimensions').textContent = `${canvas.width} × ${canvas.height}`;
    $('error').hidden = true;
    updateGroups(); workspace?.imageOpened(); render();
  } catch {
    if (currentLoad === loadId) showError('This image could not be opened. Try a JPG, PNG, or WebP image.');
  } finally { URL.revokeObjectURL(url); }
}

document.querySelectorAll('.upload').forEach(button => button.onclick = () => $('file').click());
document.querySelector('.camera').onclick = () => $('camera').click();
for (const id of ['file', 'camera']) $(id).onchange = event => { load(event.target.files[0]); event.target.value = ''; };
for (const key of ['brightness', 'contrast', 'median', 'chroma', 'cropLeft', 'cropRight', 'cropTop', 'cropBottom']) $(key).oninput = event => {
  let value = Number(event.target.value);
  const pairs = { cropLeft: ['cropRight', -1], cropRight: ['cropLeft', 1], cropTop: ['cropBottom', -1], cropBottom: ['cropTop', 1] };
  if (pairs[key]) { const [other, direction] = pairs[key]; value = direction < 0 ? Math.min(value, settings[other] - 1) : Math.max(value, settings[other] + 1); }
  event.target.value = value;
  if (key.startsWith('crop')) clearSamples();
  settings[key] = value; $(`${key}-value`).textContent = event.target.value; render();
};

function updateControls() {
  document.querySelectorAll('[data-mode]').forEach(button => {
    const active = button.dataset.mode === settings.mode;
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', active);
  });
  $('value-controls').hidden = settings.mode !== 'value';
  $('color-help').hidden = settings.mode !== 'color';
  $('chroma-help').hidden = settings.mode !== 'chroma';
  $('chroma-adjustment').hidden = settings.mode === 'value';
  $('smoothing').value = settings.smoothing; $('palette').value = settings.palette;
  $('flip').setAttribute('aria-pressed', String(settings.flip));
  $('group-gray-details').hidden = settings.levels < 2;
  document.querySelectorAll('[data-level]').forEach(button => {
    const active = Number(button.dataset.level) === settings.levels;
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', active);
  });
  $('boundary-details').hidden = settings.levels < 2;
  const levels = settings.levels || 9;
  $('value-strip').innerHTML = Array.from({ length: levels }, (_, index) => `<span style="background:rgb(${index * 255 / (levels - 1)},${index * 255 / (levels - 1)},${index * 255 / (levels - 1)})"></span>`).join('');
  const cutoffs = boundaries();
  $('boundaries').innerHTML = cutoffs.map((value, index) => `<div class="range-control"><label for="boundary-${index}">${settings.levels === 2 ? 'Black / white cutoff' : `Group ${index + 1} / ${index + 2} cutoff`}<output id="boundary-${index}-value" for="boundary-${index}">${value}</output></label><input id="boundary-${index}" data-boundary="${index}" type="range" min="${index === 0 ? 1 : cutoffs[index - 1] + 1}" max="${index === cutoffs.length - 1 ? 255 : cutoffs[index + 1] - 1}" value="${value}"/></div>`).join('');
  const grays = settings.groupGrays?.[settings.levels];
  $('group-grays').innerHTML = settings.levels >= 2 ? Array.from({ length: settings.levels }, (_, i) => slider(`gray-${i}`, `Group ${i + 1} display gray`, 0, 255, grays?.[i] ?? Uint8ClampedArray.of(i * 255 / (settings.levels - 1))[0])).join('') : '';
  updateGroups();
}

$('modes').onclick = event => {
  const button = event.target.closest('[data-mode]'); if (!button) return;
  settings.mode = button.dataset.mode; highlightedGroup = null; counts = [];
  updateControls(); render();
};
$('levels').onclick = event => {
  const button = event.target.closest('[data-level]'); if (!button) return;
  settings.levels = Number(button.dataset.level); highlightedGroup = null; counts = [];
  updateControls(); render();
};
$('boundaries').oninput = event => {
  const input = event.target.closest('[data-boundary]'); if (!input) return;
  const index = Number(input.dataset.boundary), cutoffs = boundaries();
  cutoffs[index] = Math.max(Number(input.min), Math.min(Number(input.max), Number(input.value)));
  $(`boundary-${index}-value`).textContent = cutoffs[index];
  if (index > 0) $(`boundary-${index - 1}`).max = cutoffs[index] - 1;
  if (index < cutoffs.length - 1) $(`boundary-${index + 1}`).min = cutoffs[index] + 1;
  render();
};
$('even-boundaries').onclick = () => { boundariesByLevel.set(settings.levels, defaultBoundaries(settings.levels)); updateControls(); render(); };
$('reset').onclick = () => {
  settings = structuredClone(defaults); boundariesByLevel.clear(); highlightedGroup = null; counts = [];
  for (const key of ['brightness', 'contrast', 'median', 'chroma', 'cropLeft', 'cropRight', 'cropTop', 'cropBottom']) { $(key).value = settings[key]; $(`${key}-value`).textContent = settings[key]; }
  updateControls(); render();
};

for (const key of ['smoothing', 'palette']) {
  $(key).onchange = event => {
    finishGesture(); const before = snapshot(); settings[key] = key === 'palette' ? Number(event.target.value) : event.target.value;
    record(before); render();
  };
}
$('group-grays').oninput = event => {
  const i = Number(event.target.id.replace('gray-', ''));
  if (!Number.isInteger(i)) return;
  settings.groupGrays = structuredClone(settings.groupGrays ?? {});
  settings.groupGrays[settings.levels] ??= Array.from({ length: settings.levels }, (_, index) => Uint8ClampedArray.of(index * 255 / (settings.levels - 1))[0]);
  settings.groupGrays[settings.levels][i] = Number(event.target.value);
  $(`gray-${i}-value`).textContent = event.target.value; render();
};
$('outlines').onchange = event => { outlines = event.target.checked; render(); };
$('flip').onclick = () => { settings.flip = !settings.flip; clearSamples(); updateControls(); render(); };
$('rotate').onclick = () => { settings.rotation = (settings.rotation + 1) % 4; clearSamples(); updateControls(); render(); };

function updateGroups() {
  const visible = settings.mode === 'value' && settings.levels > 1 && counts.length === settings.levels;
  $('group-areas').hidden = !visible;
  $('show-groups').hidden = highlightedGroup === null;
  $('export-help').textContent = highlightedGroup === null ? 'PNG image · up to 1600 px' : 'Export saves all groups, not the isolation view.';
  if (!visible) return;
  const total = canvas.width * canvas.height;
  $('group-buttons').innerHTML = counts.map((count, index) => {
    const value = settings.groupGrays?.[settings.levels]?.[index] ?? Uint8ClampedArray.of(index * 255 / (settings.levels - 1))[0];
    return `<button data-group="${index}" aria-pressed="${index === highlightedGroup}" class="${index === highlightedGroup ? 'active' : ''}" aria-label="Group ${index + 1}, ${(count / total * 100).toFixed(1)} percent"><span style="background:rgb(${value},${value},${value})"></span><span>${(count / total * 100).toFixed(1)}%</span></button>`;
  }).join('');
}
$('group-buttons').onclick = event => {
  const button = event.target.closest('[data-group]'); if (!button) return;
  const group = Number(button.dataset.group);
  highlightedGroup = highlightedGroup === group ? null : group;
  updateGroups(); render();
};
$('show-groups').onclick = () => { highlightedGroup = null; updateGroups(); render(); };

function compare(active) {
  if (!source) return;
  comparing = active; $('compare').classList.toggle('comparing', active); draw();
}
$('compare').onpointerdown = event => { event.preventDefault(); $('compare').setPointerCapture(event.pointerId); compare(true); };
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur']) $('compare').addEventListener(event, () => compare(false));
$('compare').onkeydown = event => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); compare(true); } };
$('compare').onkeyup = () => compare(false);
window.addEventListener('blur', () => compare(false));

function squint(active) {
  if (!source) return;
  $('dropzone').classList.toggle('squinting', active);
  $('squint').setAttribute('aria-pressed', String(active));
}
$('squint').onpointerdown = event => {
  event.preventDefault();
  $('squint').setPointerCapture(event.pointerId);
  squint(true);
};
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur']) $('squint').addEventListener(event, () => squint(false));
$('squint').onkeydown = event => {
  if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); squint(true); }
};
$('squint').onkeyup = () => squint(false);
window.addEventListener('blur', () => squint(false));

function clearSamples() {
  currentSample = null; pinnedSample = null; samplePoint = null;
  $('sample-marker').hidden = true; updateSamples();
}
$('sample-toggle').onclick = () => {
  sampling = !sampling;
  $('sample-toggle').setAttribute('aria-pressed', sampling);
  $('sampler').hidden = !sampling;
  canvas.classList.toggle('sampling', sampling);
  canvas.setAttribute('aria-label', sampling ? 'Sample colors. Tap to sample. Arrow keys move the sample point. Enter samples the selected area.' : 'Study preview. Enable Sample colors to inspect colors.');
  $('sample-marker').hidden = !sampling || !samplePoint;
  draw();
};
$('sample-source').onchange = event => {
  sampleSource = event.target.value;
  if (samplePoint) takeSample();
  draw();
};
function takeSample() {
  if (!source || !samplePoint) return;
  const image = sampleSource === 'original' ? displaySource : processedImage;
  if (!image || finishedId !== requestId) return;
  samplePoint.x = Math.max(0, Math.min(image.width - 1, samplePoint.x));
  samplePoint.y = Math.max(0, Math.min(image.height - 1, samplePoint.y));
  currentSample = { ...sampleArea(image.data, image.width, image.height, samplePoint.x, samplePoint.y), origin: sampleSource === 'original' ? 'Original' : 'Study' };
  $('sample-marker').hidden = !sampling;
  $('sample-marker').style.left = `${(samplePoint.x + 0.5) / canvas.width * 100}%`;
  $('sample-marker').style.top = `${(samplePoint.y + 0.5) / canvas.height * 100}%`;
  updateSamples();
}
canvas.onclick = event => {
  if (!sampling || !source) return;
  const rect = canvas.getBoundingClientRect();
  samplePoint = {
    x: Math.min(canvas.width - 1, Math.max(0, Math.floor((event.clientX - rect.left) / rect.width * canvas.width))),
    y: Math.min(canvas.height - 1, Math.max(0, Math.floor((event.clientY - rect.top) / rect.height * canvas.height))),
  };
  takeSample();
};
canvas.onkeydown = event => {
  if (!sampling || !source || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  samplePoint ??= { x: Math.floor(canvas.width / 2), y: Math.floor(canvas.height / 2) };
  const step = event.shiftKey ? 10 : 1;
  if (event.key === 'ArrowLeft') samplePoint.x = Math.max(0, samplePoint.x - step);
  if (event.key === 'ArrowRight') samplePoint.x = Math.min(canvas.width - 1, samplePoint.x + step);
  if (event.key === 'ArrowUp') samplePoint.y = Math.max(0, samplePoint.y - step);
  if (event.key === 'ArrowDown') samplePoint.y = Math.min(canvas.height - 1, samplePoint.y + step);
  takeSample();
};
$('pin').onclick = () => { if (currentSample) { pinnedSample = { ...currentSample, rgb: [...currentSample.rgb] }; updateSamples(); } };
$('clear-samples').onclick = clearSamples;
function sampleCard(sample, label, placeholder) {
  if (!sample) return `<div class="sample-card empty-sample"><span class="sample-letter">${label}</span><p>${placeholder}</p></div>`;
  const gray = Math.round(sample.value / 100 * 255);
  return `<div class="sample-card"><div class="sample-swatches"><span style="background:${sample.hex}"></span><span style="background:rgb(${gray},${gray},${gray})" title="Grayscale value"></span></div><div class="sample-card-title"><span>${label} <small>${sample.origin}</small></span><code>${sample.hex.toUpperCase()}</code></div><dl><div><dt>Value</dt><dd>${sample.value.toFixed(1)}<small> / 100</small></dd></div><div><dt>Chroma</dt><dd>${sample.chroma.toFixed(3)}</dd></div><div><dt>Hue</dt><dd>${sample.hue === null ? 'Neutral' : `${Math.round(sample.hue)}°`}</dd></div></dl></div>`;
}
function updateSamples() {
  $('sample-cards').innerHTML = sampleCard(pinnedSample, 'A', 'Pin a color to compare.') + sampleCard(currentSample, 'B', 'Tap the image to sample.');
  $('pin').disabled = !currentSample;
  $('sample-comparison').textContent = pinnedSample && currentSample ? compareColors(pinnedSample, currentSample) : 'Sample the lights, shadows, or a color that feels hard to judge.';
  for (const [id, sample] of [['wheel-a', pinnedSample], ['wheel-b', currentSample]]) {
    const marker = $(id); marker.hidden = !sample;
    if (!sample) continue;
    const angle = (sample.hue ?? 0) * Math.PI / 180;
    const radius = Math.min(sample.chroma / 0.4, 1) * 43;
    marker.style.left = `${50 + Math.cos(angle) * radius}%`;
    marker.style.top = `${50 + Math.sin(angle) * radius}%`;
    marker.style.background = sample.hex;
    marker.style.color = sample.value > 55 ? '#24291f' : '#ffffff';
    marker.title = `${id === 'wheel-a' ? 'A' : 'B'}: ${sample.hex}, ${sample.hue === null ? 'neutral' : `${Math.round(sample.hue)}° hue`}`;
  }
}

$('save').onclick = () => {
  if (!source || !processedImage || finishedId !== requestId) return;
  const exported = document.createElement('canvas'); exported.width = canvas.width; exported.height = canvas.height;
  exported.getContext('2d').putImageData(processedImage, 0, 0);
  exported.toBlob(blob => {
    if (!blob) { showError('The image could not be saved. Try again.'); return; }
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `still-${settings.mode}-study.png`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  });
};
const dropzone = $('dropzone');
for (const event of ['dragenter', 'dragover']) dropzone.addEventListener(event, e => { e.preventDefault(); dropzone.classList.add('dragging'); });
for (const event of ['dragleave', 'drop']) dropzone.addEventListener(event, e => { e.preventDefault(); dropzone.classList.remove('dragging'); });
dropzone.addEventListener('drop', event => load(event.dataTransfer.files[0]));
// Commit after the button's mutation handler, while capture saves its prior state.
for (const id of ['modes', 'levels', 'even-boundaries', 'reset', 'flip', 'rotate']) {
  const element = $(id);
  let before;
  element.addEventListener('click', () => { finishGesture(); before = snapshot(); }, true);
  element.addEventListener('click', () => record(before));
}
let workspace = setupWorkspace({
  get: () => ({ source, originalFile, state: snapshot(), ready: !!processedImage && finishedId === requestId, processedImage, name: $('image-label').textContent }),
  restore: state => { finishGesture(); const before = snapshot(); restore(state); record(before); },
  load,
  replace: image => {
    source = image.source; originalFile = image.originalFile;
    processedImage = null; displaySource = null; previewImage = null; currentResult = null;
    gestureStart = null; undoStack.length = 0; redoStack.length = 0;
    $('image-label').textContent = image.name;
    clearSamples(); restore(image.state);
  },
  error: showError,
});
updateControls(); updateSamples();
