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

## Current product focus

Keep the main workflow small: value groups, temporary original comparison, squint, and comparing sampled colors. Keep the photograph central. Put secondary adjustments behind disclosures and use touch targets of at least 44 pixels for the main actions.

The simple Color view keeps the photograph in color while detail smoothing removes small distracting shapes. This helps artists compare larger color areas with the original. Keep it separate from Value groups and Chroma. Use source-color smoothing, which selects a neighboring color at the middle grayscale rank. It does not guarantee preservation of every color or perceived value.

Palette reduction and the smoothing-method selector remain deferred. Palette reduction produced confusing brown or gray results in green images and skin tones. It needs artist trials before returning to the interface. Do not restore these controls simply because their processing code exists.

Keep palette-processing code and pixel tests for future work. Saved Color studies reopen in the simple Color view without hidden palette or chroma edits. Preserve framing, detail smoothing, and value settings. Show chroma adjustment only in Chroma view and clear it when entering Color view. Undo restores the earlier adjustment.

Before adding more color controls, test real references with artists and explain separately what palette reduction and detail smoothing change. Performance work and physical-device validation remain tracked in TODO.md.

## Engineering guidance

The app uses JavaScript, Vite, Canvas, and a worker for image processing. Keep expensive image operations off the main browser thread. Discard outdated processing results when the artist changes controls or opens another image.

Preserve the original image data for comparison. Export the processed result, even when the preview shows the original. Release temporary image URLs and handle unsupported files with a clear error message.

Test image operations with known pixel values and image edges. Run `npm test` and `npm run build` after code changes. Distinguish automated test results from actual browser and device testing.

Before adding a feature, answer: What visual decision does this help an artist make? If the answer is unclear, simplify the feature or leave it out.
