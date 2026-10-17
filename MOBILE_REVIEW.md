# Mobile and iPad readiness review

Reviewed on 2026-10-17. This review does not change application code.

Still is suitable for a controlled mobile beta. Resolve the findings below and complete physical-device checks before claiming mobile and iPad readiness.
The core processing, comparison, sampling, undo, and export workflows passed the WebKit scenarios described below.

## Findings

### P1: Bound full-resolution export memory

Locations: `src/worker.js:6`, `src/worker.js:14`, `src/study.js:164`, `src/study.js:187`, `src/study.js:206`.

Native export decodes the entire photograph, reads its pixels, and runs the same pipeline that creates preview-only buffers.
The pipeline allocates full-size original, adjusted, output, preview, grayscale, and group arrays. Export then creates another full-size canvas.
There is no pixel-count budget, export dimension limit, or reduced-resolution option between the working preview and native export.

One RGBA buffer for a 48-megapixel image contains 192 MB of pixel data. Several copies can put export memory above a gigabyte, before canvas overhead.
This is a code-based memory risk, not a measured crash on an iPhone or iPad.
A worker keeps computation off the interface thread, but does not impose a memory budget on the browser.

Before release, add a bounded export resolution and avoid allocating histogram, group, and preview data for exports.
Larger exports need a separate strategy and real-device memory measurements. Do not rely on the error handler to recover from browser process termination.

### P2: Move errors beside the image

Locations: `src/main.js:61`, `src/main.js:189`, `src/main.js:216`.

The alert appears after the footer. Opening an invalid image on a 390 × 844 viewport placed the error at approximately y=1992.
The upload leaves the user near the top of the page, where the error is not visible. Assistive announcement does not solve the visual feedback gap.

Place image errors in the preview or another visible status area. Keep storage and export errors beside their respective actions.
Test failure paths as visible interactions, rather than asserting only that alert text exists in the document.
The invalid-file test does not establish whether a particular real HEIC file is supported.

### P2: Enlarge touch controls and tablet labels

Locations: `src/style.css:1`, `src/style.css:12`, `src/style.css:20`, `src/style.css:50`, `src/style.css:51`, `src/style.css:54`.

Measured WebKit layouts contain a roughly 22-pixel-high original comparison button and 33-pixel-high Squint button.
The sample-source select rendered around 18 pixels high. Seven group buttons were approximately 28 pixels wide in iPad portrait.
Range inputs have 4–5 pixel element heights, with 13-pixel desktop or 19-pixel phone thumbs. These are not comfortable touch targets.

The narrow-screen adjustments stop at 650 pixels, so iPads retain many 8–11 pixel desktop labels and small slider thumbs.
Use touch-aware styles at tablet widths, provide approximately 44 × 44 pixel interactive areas, and increase key labels.
Keep a thin visible slider track inside a larger input hit area. Do not disable page zoom.

### P2: Stop reprocessing an unchanged comparison

Locations: `src/main.js:131`, `src/workspace.js:63`, `src/workspace.js:71`, `src/workspace.js:238`.

Every render invokes the comparison callback. That callback terminates and restarts the companion worker even when its source and adjustments are unchanged.
An instrumented run confirmed that an unlinked brightness change sent two processing jobs. Highlighting a value group also reprocessed both images.
Slider input can repeat this behavior for every event and copy both source buffers repeatedly.

Compare each image's processing inputs before dispatching a job. Keep a stable worker and schedule only the latest necessary work.
Group isolation and outline changes need a display update, rather than recalculation of the median filter and palette.
Measure responsiveness on older devices after this change.

## Verification completed

- All 28 unit tests passed.
- The production build passed.
- Ran all 18 existing workflows in WebKit at 390 × 844, 768 × 1024, and 1024 × 768, with mobile and touch emulation.
- Of those 54 scenarios, 51 passed. The three failures were the photo-saving gallery scenario in temporary WebKit contexts.
- Isolated the storage failure: temporary WebKit contexts rejected both File and Blob values with an UnknownError. Byte arrays worked.
- A persistent WebKit context accepted File and Blob storage. Photo save, page reload, gallery reopen, and touch sampling passed separately in that context.
- Production offline reload and fresh image processing passed in WebKit after the app shell cache installed.
- Inspected layouts at widths of 320, 390, 768, 820, and 1024 pixels. The inspected study and comparison layouts did not overflow horizontally.
- Inspected iPad portrait and landscape screenshots and measured small controls.

WebKit runs here use the current Playwright WebKit build on a Mac. Mobile settings do not reproduce iOS memory limits, camera hardware, or every shipping Safari version.
The repository configuration still lacks permanent iPad and mobile WebKit projects. The additional review configuration and screenshots were temporary artifacts under `/tmp`.
The gallery test needs a persistent context, or an explicit supported fallback for restricted photo storage, before its result can establish Safari compatibility.

## Physical-device release checks

- Open a large photograph from an iPhone camera library, including a real HEIC file and an image with orientation metadata.
- Capture a still photo and confirm that orientation, dimensions, comparison, and samples agree.
- Drag sliders and hold comparison controls with fingers on an older phone and an iPad.
- Rotate the device and use iPad split view while sampling and comparing two images.
- Save a working-resolution PNG, then exercise the bounded full-resolution export and cancellation flow.
- Confirm the actual Safari download or share destination and reopen the exported file.
- Install the app on the home screen, relaunch it offline, and reopen a locally saved study.
- Check photo saving and its error message in both normal and restricted/private browsing contexts.
