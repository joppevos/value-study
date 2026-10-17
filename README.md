# Still

Still helps artists study large shapes, values, and color relationships in photographs. It runs in the browser without accounts or photo uploads.
Value means how light or dark a color appears. Chroma means how muted or intense a color appears.

## Run the app

Use Node.js 18 or later. Install dependencies, then start the development server. Open the address that Vite prints.

```sh
npm install
npm run dev
```

To use a phone or tablet, connect it to the same network as the computer. Open the computer's network address and Vite port.
Take a photo opens the device file picker and requests its rear camera where supported. Camera behavior depends on the browser and device.

## Study values and color

Upload a photo, take a photo, or drop an image into the preview. The working image uses at most 1600 pixels on its longest side.
Still retains the original file in memory for full-resolution export. It does not persist that file unless you explicitly save the photo locally.

Value view offers a full grayscale range or 2, 3, 4, 5, or 7 groups. Adjust value boundaries changes each cutoff.
Cutoffs cannot cross. Each group count remembers its own boundaries during the session.
The histogram shows the area at each adjusted grayscale value before grouping. Vertical lines mark the boundaries.

Select a value group to isolate its shapes. Coverage percentages describe the photograph, including transparent areas composited onto white.
Display grays & outlines changes the appearance of each group without changing its coverage. Outlines appear only in the preview.

Color view keeps color and offers two smoothing methods. Select neighboring colors chooses an actual neighboring color at the middle grayscale rank.
Separate RGB medians filters each color channel independently and can create new colors. Neither method guarantees preservation of perceived value.

Color limit selects up to the chosen number of colors from the image after smoothing, brightness, contrast, and chroma adjustments.
It is separate from the median radius, which removes small details. It does not use a fixed or preset palette.
The selection groups nearby colors in OKLab, a perceptual color model, and refines them using their image coverage.
Each representative is an existing color in that adjusted image. The result balances lightness and color differences rather than reserving slots for named hues.
Swatches show the chosen colors and their coverage percentages. Some images need fewer colors than the selected maximum.

Chroma view maps OKLCH color intensity from black to white on a fixed scale of 0 to 0.4.
Neutral areas appear black. High intensity areas appear bright. Brightness in this view does not represent the photograph's value.

Chroma adjustment changes OKLCH chroma while holding model lightness before rounding to display RGB values.
If a color exceeds the display range, Still reduces its chroma at the same model lightness and reports the affected image area.
This does not promise identical perceived value, physical paint behavior, or preservation of the app's weighted grayscale value.

## Frame and compare decisions

On phone and tablet widths, opening a photo hides the branding and introduction and reduces space around the preview.
Use Open image beside the filename to choose another photo. The initial welcome screen remains available before opening a photo.

Framing offers crop edges as percentages, quarter-turn rotation, and horizontal flip. Crop applies before rotation and flip.
Original comparison and sampling use that same framing. Undo and Reset can restore the earlier framing.
Hold to squint temporarily shrinks the preview. Hold to see original temporarily shows the framed original photo.

Undo and Redo cover study adjustments, boundaries, display grays, framing, and Reset.
One slider gesture counts as one change. A new adjustment clears redo. History keeps the latest 100 changes during the session.
Opening another photo or switching the edited image starts fresh history. Use Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z outside form controls.

Open Compare, frame & save for preview backgrounds, thirds or center grids, and Hide controls.
Grids and backgrounds do not change samples or exports. Show controls or Escape exits the view with hidden controls.

## Compare a reference and a painting

Open Reference & painting, then Open painting to choose a second photograph. Both images share the selected study view.
Adjustments and export apply to the image on the left. Switch images moves the other image into that editing position.
Unlinked study adjustments remain independent. Linked adjustments share brightness, contrast, smoothing, palette, chroma, value groups, and boundaries.
Framing stays independent. Matching adjustments does not correct lighting or exposure differences between photographs.

Alignment controls move and scale the second preview to compare corresponding areas. Alignment changes only that preview.
Still does not score accuracy or treat artistic differences as errors.

Study variations keeps up to eight versions of the current photo during the session.
Load restores a variation through undo history. Compare places it beside the current study in the shared study view.
Opening another photo or switching images clears session variations.

## Compare sampled colors

Enable Sample colors, then choose Original photo or Processed study. The preview shows that source while sampling.
Tap the image to average an area of up to 5 × 5 pixels. Pin as A keeps one sample while you choose B.
The comparison describes their weighted grayscale values, color intensity, and hue difference.

The wheel uses OKLCH hue around its edge and chroma as distance from its center. Neutral samples have no meaningful hue.
It is a relative guide to sampled colors, not a paint-mixing wheel. Samples describe the photograph, not physical paint.
For keyboard sampling, focus the preview and press Enter. Arrow keys move one pixel. Shift with an arrow key moves ten pixels.

## Save and export

Save study exports the complete processed image at the working resolution, even during original comparison or group isolation.
Full-resolution export processes the original file in a separate worker. It scales the smoothing radius to the native image resolution.
Both exports include crop, rotation, flip, and custom display grays. Neither includes grids, preview outlines, or isolation backgrounds.
Large native exports need more memory and time. Cancel export stops that worker. The working-resolution export remains available as a fallback.

Save on this device offers a local gallery. Saved studies contain adjustments only by default.
Include the original photo explicitly stores that photo alongside its adjustments in browser storage. Delete removes a saved study.
Remember adjustments between visits saves only adjustment data. It does not save photos or session history.
Browser storage can be unavailable, cleared, or full. Export PNG copies of work you need to keep.

## Offline use and installation

Production builds cache the app shell and processing worker after the first successful visit. The interface uses system fonts without external requests.
Offline setup reports when the cache is ready. The development server does not install an offline cache.
Installation is available through supported browser menus. An Install Still button appears when the browser provides an installation prompt.
Offline and home-screen behavior still need browser and physical-device testing.

```sh
npm run build
npm run preview
```

## GitHub Pages deployment

Open [Still on GitHub Pages](https://joppevos.github.io/value-study/) on a phone, iPad, or computer.
In the repository settings, select Pages and set the deployment source to GitHub Actions.
The deployment workflow tests the app, builds `dist`, and publishes successful builds after pushes to `main`.
It reads the base path from GitHub Pages so that a future custom domain can use the site root.

To test the production build under the repository path locally, run:

```sh
STILL_BASE_PATH=/value-study/ npm run build
npm run test:pages
```

The deployment tests cover phone and iPad screen sizes, worker loading, export, installation files, and offline reload.
A custom domain remains a future task in TODO.md. Saved studies do not automatically move between different hostnames.

## Tests and measurements

Unit tests cover known pixels, image edges, source-color smoothing, palette limits, framing, chroma, histogram counts, and offline cache generation.
Browser scenarios cover the main workflow at desktop and phone screen sizes. WebKit coverage is not a substitute for Safari on a physical device.
Chromium can now run in this environment. Physical-device tests and broader Safari and Firefox checks remain separate from automated Chromium coverage.

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npx playwright install firefox webkit
STILL_ALL_BROWSERS=1 npm run test:e2e
npm run benchmark
```

The benchmark uses synthetic pixels in desktop Node.js and reports elapsed time and process memory.
It does not establish speed or memory use on phones. See TODO.md for the outstanding validation and device measurements.
