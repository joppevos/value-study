# Still

Still helps artists understand an image before their next brushstroke. Every tool must help an artist make a visual decision. Keep the app focused on observation, comparison, and simplification.

## Purpose

Artists use Still beside an easel or sketchbook on a phone, iPad, or laptop. They open a reference or photograph their work, then examine its larger shapes. The app supports artistic judgment rather than grading accuracy.

Value means how light or dark a color appears. Chroma means how muted or intense a color appears. Hue means the color family, such as red or blue. Keep these concepts distinct in tools and explanations.

## Product principles

- Help artists see large shapes before small details.
- Give each control a clear visual purpose.
- Keep the image central and the controls quiet.
- Make experiments reversible through comparison, reset, and eventually undo.
- Use large touch targets and readable labels across screen sizes.
- Process photos on the device. Do not upload images without explicit consent.
- Support photo uploads and taking a still photo. Live camera filters are outside the current scope.
- Keep the core workflow available without accounts or subscriptions.
- Prefer useful visual comparisons over unexplained numbers.

A color wheel must explain colors in the current image. Color samples must help artists compare relationships, not collect isolated measurements. Simplification must preserve useful relationships rather than merely produce an attractive effect.

## Boundaries

Do not add paint tube databases, paint inventory, brand catalogs, or mixing recipes. Do not turn Still into a general photo editor or a social platform. Do not add automatic accuracy scores that treat artistic choices as errors.

Camera exposure, lighting, and screens affect the image that artists see. Describe measurements as properties of the photograph, not exact measurements of physical paint. Do not promise that color adjustments preserve perceived value unless the implementation supports that claim.

## Feature direction

The next improvements are:

- Color-preserving median filtering. A median filter removes small details through nearby middle values.
- Adjustable boundaries between value groups, rather than only a fixed number of groups.
- Tap-to-compare color samples, with small-area sampling to reduce noise.

Later improvements include:

- Color simplification that reduces the palette and small distracting shapes.
- A chroma view that distinguishes muted and intense areas.
- A color wheel connected to sampled colors.
- Highlighting individual value groups and showing their image coverage.
- A temporary squint view that softens detail or reduces preview size.
- Side-by-side comparison of a reference and a painting.
- Crop, rotation, undo, saved variations, and a distraction-free view.

These features describe product direction, not completed functionality. Choose small, testable additions instead of exposing all tools at once. Keep reducing palette size separate from removing small shapes.

## Engineering guidance

The app uses JavaScript, Vite, Canvas, and a worker for image processing. Keep expensive image operations off the main browser thread. Discard outdated processing results when the artist changes controls or opens another image.

Preserve the original image data for comparison. Export the processed result, even when the preview shows the original. Release temporary image URLs and handle unsupported files with a clear error message.

Test image operations with known pixel values and image edges. Run `npm test` and `npm run build` after code changes. Distinguish automated test results from actual browser and device testing.

Before adding a feature, answer: What visual decision does this help an artist make? If the answer is unclear, simplify the feature or leave it out.
