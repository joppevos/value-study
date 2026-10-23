import { studyStore } from './storage.js';
import { sanitizeState } from './state.js';

const $ = id => document.getElementById(id);
const copy = value => structuredClone(value);

function download(blob, name) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function decode(file, maxLongest = 1600) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    const scale = Math.min(1, maxLongest / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return context.getImageData(0, 0, canvas.width, canvas.height);
  } finally { URL.revokeObjectURL(url); }
}

export function setupWorkspace(app) {
  $('workspace-tools').innerHTML = `
    <div class="tool-row"><button id="focus-view" class="button" aria-pressed="false">Hide controls</button><label>Surround<select id="surround"><option value="default">Soft gray</option><option value="white">White</option><option value="gray">Middle gray</option><option value="dark">Dark</option></select></label></div>
    <details><summary>Reference & painting</summary><p>Open a second photo to compare large shapes. Controls and export apply to the image on the left. Switch images to edit the other photo.</p><div class="tool-row"><button id="add-companion" class="button" disabled>Open painting</button><button id="switch-images" class="button" disabled>Switch images</button><button id="remove-companion" class="button" disabled>Close comparison</button></div><label class="check-label"><input id="link-adjustments" type="checkbox"/> Link study adjustments</label><p>Both images share the same study view. Linked adjustments exclude framing. They do not correct exposure or lighting differences.</p><input id="companion-file" type="file" accept="image/*" hidden/>
    <details><summary>Align the second preview</summary><p>Move and scale the second preview to compare corresponding areas. Alignment affects this preview only.</p><label>Horizontal offset (%)<input id="align-x" type="range" min="-50" max="50" value="0"/></label><label>Vertical offset (%)<input id="align-y" type="range" min="-50" max="50" value="0"/></label><label>Scale (%)<input id="align-scale" type="range" min="25" max="200" value="100"/></label><button id="align-reset" class="button">Reset alignment</button></details></details>
    <details><summary>Study variations</summary><p>Keep up to eight variations for this photo during the session. Load one or place it beside the current study.</p><button id="add-variation" class="button" disabled>Keep variation</button><div id="variations" class="saved-list"></div></details>
    <details><summary>Save on this device</summary><p>Browser storage can be cleared or reach its limit. Export PNG copies for work you need to keep.</p><label class="check-label"><input id="remember-adjustments" type="checkbox"/> Remember adjustments between visits</label><label class="select-label" for="study-name">Study name<input id="study-name" type="text" maxlength="100" placeholder="My study"/></label><label class="check-label"><input id="save-photo" type="checkbox"/> Include the original photo in this saved study</label><p>Photo saving is optional and stays on this device. Otherwise, saved studies contain adjustments only.</p><button id="save-local" class="button" disabled>Save study locally</button><p id="storage-status" role="status"></p><div id="gallery" class="saved-list"></div></details>
    <details><summary>Full-resolution export</summary><p>Process the original file at its native resolution. Large photos take more time and memory. Export includes framing and adjustments, without grids, outlines, or isolation.</p><button id="export-full" class="button" disabled>Export full resolution</button><button id="cancel-export" class="button" hidden>Cancel export</button><p id="full-export-status" role="status"></p></details>
    <p id="offline-status" role="status"></p><button id="install-app" class="button" hidden>Install Still</button>`;

  // The focus exit remains visible even after controls disappear.
  const exit = document.createElement('button'); exit.id = 'exit-focus'; exit.className = 'button'; exit.textContent = 'Show controls'; exit.hidden = true;
  document.body.append(exit);
  function focus(active) {
    document.body.classList.toggle('focus-view', active); exit.hidden = !active;
    $('focus-view').setAttribute('aria-pressed', String(active));
    (active ? exit : $('focus-view')).focus();
  }
  $('focus-view').onclick = () => focus(true); exit.onclick = () => focus(false);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !exit.hidden) focus(false); });
  $('surround').onchange = () => document.querySelector('.comparison-pair').dataset.surround = $('surround').value;
  function updateGrid(mode = 'none') {
    $('grid').querySelectorAll('[data-grid]').forEach(button => {
      const active = button.dataset.grid === mode;
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', active);
    });
    const positions = mode === 'thirds' ? [100 / 3, 200 / 3] : mode === 'center' ? [50] : [];
    $('grid-overlay').innerHTML = positions.map(p => `<path d="M${p} 0V100M0 ${p}H100"/>`).join('');
  }
  $('grid').onclick = event => {
    const button = event.target.closest('[data-grid]');
    if (button) updateGrid(button.dataset.grid);
  };
  updateGrid();

  let companion = null, companionWorker = null, companionGeneration = 0, loadGeneration = 0, swapping = false;
  let variations = [], exportWorker = null;
  function resetAlignment() {
    $('align-x').value = 0; $('align-y').value = 0; $('align-scale').value = 100; align();
  }
  function align() {
    $('companion-preview').style.transform = `translate(${$('align-x').value}%,${$('align-y').value}%) scale(${Number($('align-scale').value) / 100})`;
  }
  for (const id of ['align-x', 'align-y', 'align-scale']) $(id).oninput = align;
  $('align-reset').onclick = resetAlignment;

  function renderCompanion() {
    if (!companion) return;
    const active = app.get().state;
    companion.state.settings.mode = active.settings.mode;
    if ($('link-adjustments').checked) {
      for (const key of ['levels', 'brightness', 'contrast', 'median', 'smoothing', 'palette', 'chroma', 'groupGrays']) companion.state.settings[key] = copy(active.settings[key]);
      companion.state.boundaries = copy(active.boundaries);
    }
    companionWorker?.terminate(); companionWorker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    const id = ++companionGeneration;
    $('companion-status').textContent = 'Developing comparison…';
    $('companion').hidden = false;
    document.querySelector('.comparison-pair').classList.add('has-companion');
    $('companion-label').textContent = companion.name;
    const error = message => { if (id === companionGeneration) $('companion-status').textContent = message; };
    companionWorker.onmessage = ({ data }) => {
      if (id !== companionGeneration) return;
      if (data.error) { error(data.error); return; }
      const canvas = $('companion-preview'); canvas.width = data.width; canvas.height = data.height;
      canvas.getContext('2d').putImageData(new ImageData(data.output, data.width, data.height), 0, 0);
      $('companion-status').textContent = `${data.width} × ${data.height} · ${active.settings.mode} study`;
    };
    companionWorker.onerror = () => error('This comparison could not be processed. Try a smaller photo.');
    const settings = { ...companion.state.settings, boundaries: companion.state.boundaries.find(([level]) => level === companion.state.settings.levels)?.[1] };
    companionWorker.postMessage({ id, pixels: companion.source.data, width: companion.source.width, height: companion.source.height, settings });
    $('switch-images').disabled = false; $('remove-companion').disabled = false;
  }
  function closeCompanion() {
    ++loadGeneration; ++companionGeneration; companionWorker?.terminate(); companionWorker = null; companion = null;
    $('companion').hidden = true; document.querySelector('.comparison-pair').classList.remove('has-companion');
    $('switch-images').disabled = true; $('remove-companion').disabled = true; resetAlignment();
  }
  $('add-companion').onclick = () => $('companion-file').click();
  $('companion-file').onchange = async event => {
    const file = event.target.files[0]; event.target.value = ''; if (!file || !app.get().source) return;
    const id = ++loadGeneration;
    try {
      const source = await decode(file); if (id !== loadGeneration) return;
      companion = { source, originalFile: file, state: copy(app.get().state), name: file.name || 'Painting' };
      resetAlignment(); renderCompanion();
    } catch { if (id === loadGeneration) app.error('The second photo could not be opened. Try a JPG, PNG, or WebP image.'); }
  };
  $('link-adjustments').onchange = renderCompanion;
  $('switch-images').onclick = () => {
    if (!companion) return;
    ++loadGeneration; cancelExport();
    const previous = app.get(), next = companion;
    companion = { source: previous.source, originalFile: previous.originalFile, state: copy(previous.state), name: previous.name };
    variations = []; drawVariations();
    swapping = true; app.replace(next); swapping = false; resetAlignment(); renderCompanion();
  };
  $('remove-companion').onclick = closeCompanion;

  function button(text, action) {
    const b = document.createElement('button'); b.className = 'button'; b.textContent = text; b.onclick = action; return b;
  }
  function drawVariations() {
    $('variations').replaceChildren();
    variations.forEach((variation, i) => {
      const row = document.createElement('div'); row.className = 'saved-row';
      const title = document.createElement('span'); title.textContent = `Variation ${variation.number}`;
      row.append(title, button('Load', () => app.restore(copy(variation.state))), button('Compare', () => {
        const active = app.get();
        $('link-adjustments').checked = false;
        companion = { source: active.source, originalFile: active.originalFile, name: `Variation ${variation.number}`, state: copy(variation.state) };
        resetAlignment(); renderCompanion();
      }), button('Remove', () => { variations.splice(i, 1); drawVariations(); }));
      $('variations').append(row);
    });
    $('add-variation').disabled = !app.get().source || variations.length >= 8;
  }
  let nextVariation = 1;
  $('add-variation').onclick = () => {
    if (!app.get().source || variations.length >= 8) return;
    variations.push({ number: nextVariation++, state: copy(app.get().state) }); drawVariations();
  };

  let galleryGeneration = 0;
  async function refreshGallery() {
    const generation = ++galleryGeneration;
    try {
      const studies = await studyStore('list'); if (generation !== galleryGeneration) return;
      $('gallery').replaceChildren();
      studies.sort((a, b) => b.created - a.created).forEach(study => {
        const row = document.createElement('div'); row.className = 'saved-row';
        const title = document.createElement('span'); title.textContent = `${study.name} · ${study.photo ? 'Photo + adjustments' : 'Adjustments only'}`;
        row.append(title, button('Open', async () => {
          try {
            const state = sanitizeState(study.state); if (!state) throw new Error('Invalid adjustments');
            if (study.photo) { await app.load(study.photo); if (app.get().originalFile !== study.photo) return; }
            app.restore(state);
            $('storage-status').textContent = study.photo ? 'Opened the saved photo and adjustments.' : 'Loaded adjustments. Open a photo to use them.';
          } catch { app.error('This saved study could not be opened.'); }
        }), button('Delete', async () => {
          try { await studyStore('delete', study.id); $('storage-status').textContent = 'Deleted the saved study from this device.'; await refreshGallery(); }
          catch { app.error('This saved study could not be deleted.'); }
        }));
        $('gallery').append(row);
      });
    } catch { $('storage-status').textContent = 'Local study storage is unavailable in this browser.'; }
  }
  $('save-local').onclick = async () => {
    const active = app.get(); if (!active.source) return;
    $('save-local').disabled = true;
    try {
      const include = $('save-photo').checked;
      await studyStore('save', { id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`, created: Date.now(), name: $('study-name').value.trim() || active.name || 'My study',
        state: copy(active.state), photo: include ? active.originalFile : null });
      $('storage-status').textContent = include ? 'Saved this photo and its adjustments on this device.' : 'Saved adjustments only. No photo was stored.';
      await refreshGallery();
    } catch { app.error('The study could not be saved. Browser storage can be unavailable or full. Export a PNG to keep the result.'); }
    finally { $('save-local').disabled = !app.get().source; }
  };
  function remember() {
    try {
      if ($('remember-adjustments').checked) localStorage.setItem('still-adjustments', JSON.stringify(app.get().state));
      else localStorage.removeItem('still-adjustments');
    } catch { $('storage-status').textContent = 'The browser could not remember adjustments.'; }
  }
  $('remember-adjustments').onchange = remember;
  queueMicrotask(() => {
    try {
      const saved = localStorage.getItem('still-adjustments');
      const state = saved ? sanitizeState(JSON.parse(saved)) : null;
      if (state) { $('remember-adjustments').checked = true; app.restore(state); }
    } catch { /* Unavailable or invalid preferences do not prevent opening a photo. */ }
    refreshGallery();
  });

  function cancelExport() {
    exportWorker?.terminate(); exportWorker = null;
    $('cancel-export').hidden = true; $('export-full').disabled = !app.get().originalFile;
  }
  $('cancel-export').onclick = () => { cancelExport(); $('full-export-status').textContent = 'Export canceled.'; };
  $('export-full').onclick = async () => {
    const active = app.get(); if (!active.originalFile || exportWorker) return;
    exportWorker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    $('export-full').disabled = true; $('cancel-export').hidden = false; $('full-export-status').textContent = 'Processing the full-resolution photo…';
    const settings = copy(active.state.settings);
    settings.boundaries = active.state.boundaries.find(([level]) => level === settings.levels)?.[1];
    // Keep the same relative smoothing footprint at the native resolution.
    exportWorker.onmessage = ({ data }) => {
      if (data.error) { $('full-export-status').textContent = 'Full-resolution export failed. Try the working-resolution Save study button.'; }
      else { download(data.blob, `still-${settings.mode}-full.png`); $('full-export-status').textContent = 'Full-resolution PNG exported.'; }
      cancelExport();
    };
    exportWorker.onerror = () => { $('full-export-status').textContent = 'Full-resolution export failed. Try the working-resolution Save study button.'; cancelExport(); };
    const job = exportWorker;
    try {
      const request = { id: 1, settings, export: true, previewLongestSide: Math.max(active.source.width, active.source.height) };
      if (active.originalFile.type === 'image/svg+xml' || /\.svg$/i.test(active.originalFile.name ?? '')) {
        // Browsers can display SVGs through Image even when worker bitmap decoding
        // rejects them. Rasterize that format once, then process it in the worker.
        const native = await decode(active.originalFile, Infinity);
        if (exportWorker !== job) return;
        job.postMessage({ ...request, pixels: native.data, width: native.width, height: native.height }, [native.data.buffer]);
      } else job.postMessage({ ...request, blob: active.originalFile });
    } catch {
      if (exportWorker === job) { $('full-export-status').textContent = 'Full-resolution export failed. Try the working-resolution Save study button.'; cancelExport(); }
    }
  };
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; $('install-app').hidden = false; });
  $('install-app').onclick = async () => { if (!installPrompt) return; await installPrompt.prompt(); installPrompt = null; $('install-app').hidden = true; };
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then(async registration => {
      if (registration.active) $('offline-status').textContent = 'Still is available offline on this device.';
      registration.addEventListener('updatefound', () => {
        registration.installing?.addEventListener('statechange', event => {
          if (event.target.state === 'activated') $('offline-status').textContent = 'Still is available offline on this device.';
        });
      });
    }).catch(() => { $('offline-status').textContent = 'Offline setup did not finish. You can keep using Still online.'; });
  }
  return {
    adjustmentsChanged() { remember(); if (!swapping) renderCompanion(); },
    imageOpened() {
      variations = []; nextVariation = 1; drawVariations(); closeCompanion(); cancelExport();
      $('add-companion').disabled = false; $('save-local').disabled = false; $('export-full').disabled = false;
    },
  };
}
