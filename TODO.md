# Still development plan

Still helps artists study photos before they paint. Photos stay on the device. The core workflow needs no account or subscription.
Paint inventories, mixing recipes, live camera filters, and accuracy scores are outside this plan.

## Implementation and validation status

The original feature backlog was implemented as of 2026-10-17; palette reduction remains deliberately deferred. Four mobile release issues remain open below. Checked items describe code, not approval from artist trials or physical-device tests.
Value, Color, and Chroma views remain available, alongside original-photo color sampling. Extra composition, comparison, and storage tools live in collapsed sections.
Relevant tests cover known pixels and image edges. Browser and device validation remain open at the end of this plan.

## Focused artist workflow

- [x] Add a simple Color view for detail smoothing in color. Keep palette reduction and the smoothing-method selector out of the interface.
- [x] Keep original comparison, squint, and color sampling together beneath the image with touch-sized buttons.
- [x] Keep value groups visible and put the histogram and light and shadow adjustments behind disclosures.
- [x] Reopen older Color studies in the simple Color view without hidden palette or chroma edits. Retain framing, smoothing, and value settings.
- [ ] Revisit palette reduction only after artist trials with green images, skin tones, and real paintings show useful color relationships. See AGENTS.md for the decision.

Historical checked palette implementation items below describe retained processing code, not currently exposed controls.

## Hosting and custom domain

- [x] Publish the mobile beta at [joppevos.github.io/value-study](https://joppevos.github.io/value-study/) through GitHub Pages.
  The workflow runs unit tests, builds at the deployment path, and tests worker loading, PNG export, manifest paths, and offline reload before publishing.
  On 2026-10-17, all six deployment checks also passed against the live HTTPS site at phone and iPad screen sizes. Physical-device testing remains open.
- [ ] Choose a custom domain or subdomain for Still before a wider release. Connect it to GitHub Pages and enable HTTPS.
  Use the same hostname if hosting moves later. A different hostname does not automatically inherit locally saved studies or remembered adjustments.
- [ ] Plan the move from the GitHub address to the custom domain. Explain how testers can export work before the address changes.

## Mobile and iPad release priorities

Resolve these four findings before calling Still ready for general mobile and iPad use.
The [mobile readiness review](MOBILE_REVIEW.md) contains evidence, code locations, and reproduction details.

- [ ] P1: Bound full-resolution export memory. Add an export resolution limit and skip preview-only buffers during export.
  Test large photographs and cancellation within the memory budget. Keep working-resolution export available as a fallback.
- [ ] P2: Enlarge touch controls and tablet labels. Provide approximately 44 × 44 pixel interactive areas for buttons, selects, group selectors, and sliders.
  Keep thin slider tracks inside larger touch areas. Apply readable labels and touch styles at iPad widths, not only below 650 pixels.
- [ ] P2: Show errors beside the relevant action. Put image errors in the preview and storage or export errors beside their controls.
  Test that an invalid-image message is visible without scrolling on a phone.
- [ ] P2: Avoid processing unchanged comparison images. Dispatch work only when an image's source or processing adjustments change.
  Keep workers stable where possible. Update group isolation and outlines without recalculating smoothing or palette reduction.
  Test that unlinked adjustments leave the other image's processing untouched and that slider changes schedule only the latest necessary work.

## Existing artist tools

- [x] Add Value and Color views without clearing adjustments when switching views.
- [x] Apply a median filter to color images, with separate RGB channels available as an option.
- [x] Adjust every boundary for value group counts of 2, 3, 4, 5, and 7.
- [x] Show the area covered by each value group and highlight individual groups.
- [x] Sample a small area of the original photo or the processed study.
- [x] Pin one color, compare it with a second color, and show both on a color wheel.
- [x] Compare the study with the original through a temporary hold control.
- [x] Export the complete processed study as PNG, even during original comparison or group isolation.
- [x] Add image-processing tests and browser scenarios for desktop and phone screen sizes.

The wheel uses OKLCH hue and chroma. It is not a paint-mixing wheel.
Samples describe the photograph rather than exact measurements of physical paint.
The working preview uses at most 1600 pixels on the longest side. Full-resolution export uses the retained original file.

## Priority 1: See large shapes and compare decisions

- [x] Add undo and redo for adjustments, reset, value boundaries, custom display grays, and framing. Treat one slider gesture as one change.
- [x] Add a temporary Squint view with a smaller preview. Restore normal size when released. Adjustable blur remains optional.
- [x] Add a median option that selects a neighboring source color at the middle grayscale rank. Test boundaries and small shapes.
- [x] Reduce the image to a representative palette, with resulting color swatches and image coverage available in their labels.
- [x] Control palette size separately from detail smoothing.

Source-color smoothing retains neighboring RGB triplets after brightness and contrast adjustments. It does not guarantee preservation of every color or perceived value.
Palette reduction refines weighted OKLab color groups and selects representative source colors. It uses population averages rather than the first pixel in each bucket. Assess its usefulness with artists alongside the original photo.

## Priority 2: Compare a reference with a painting

- [x] Compare two photographs side by side without accuracy scores.
- [x] Share the study view and offer independent or linked study adjustments. Keep framing independent.
- [x] Add reversible crop edges, quarter-turn rotation, and horizontal flip.
- [x] Keep up to eight variations of one study during the session. Load a variation or compare it with the current study.

Controls and export apply to the left image. Switch images selects the other photograph for editing.
Opening another photo or switching images starts fresh undo history and clears session variations.
Matching adjustment values does not correct differences in exposure or lighting between photographs.

## Priority 3: Support composition and value decisions

- [x] Keep the image position and size stable when study views or sidebar content change. Cover this with Chromium and mobile/iPad WebKit regression tests.
- [x] Use a compact study layout on phone and tablet widths once a photo opens. Hide branding and introductory text, retain Open image, and reduce preview padding.

- [x] Keep sampling, original comparison, and export consistent with horizontal flip and other framing changes.
- [x] Add a view that hides controls, with a visible exit and Escape support.
- [x] Offer white, middle gray, and dark preview backgrounds. Keep these separate from transparency compositing.
- [x] Add a histogram of adjusted grayscale values before grouping. Compute it in the worker after brightness, contrast, and smoothing.
- [x] Show value boundaries on the histogram and keep their sliders connected to the result.
- [x] Add thirds and center grids. Exclude them from samples and exports.

## Priority 4: Understand color intensity

Chroma means how muted or intense a color appears. Perceptual lightness describes how light a color appears in a color model.
The weighted grayscale calculation in Value view differs from perceptual lightness.

- [x] Add a chroma view with a fixed, labeled scale from muted to intense. Keep it distinct from value.
- [x] Add OKLCH chroma adjustment that holds model lightness before display rounding. Test the rounding tolerance.
- [x] Reduce chroma at the same model lightness when colors exceed the display range. Report the affected image area.

Holding model lightness does not promise identical perceived value or unchanged weighted grayscale values.

## Additional study and everyday tools

These previously deferred features are now available as optional controls. Artist trials still need to establish how useful they are.
Saved photos require an explicit choice. Remembered adjustments never include photo data.

- [x] Add optional outlines around value groups in the preview. Keep the complete study export free of outlines.
- [x] Add custom display grays without changing group boundaries or coverage.
- [x] Add manual translation and scale for the second preview. Keep alignment separate from image processing and export.
- [x] Add a local study gallery with save, open, and delete actions, plus storage-limit and deletion explanations.
- [x] Save adjustments only by default. Store the original photo only when explicitly selected.
- [x] Offer remembered adjustments between visits without saving photos.
- [x] Add a production offline app cache, a home-screen manifest, install controls where supported, and system fonts.

## Performance implementation

- [x] Retain the original file in memory and process full-resolution export separately from the working preview.
- [x] Add cancellation for full-resolution export.
- [x] Terminate superseded processing workers and reject outdated results when controls or images change.
- [x] Move value-group isolation and preview outlines into the processing worker.
- [x] Add a repeatable synthetic desktop benchmark for elapsed processing time and process memory.

The desktop benchmark does not establish phone performance. Large native exports can exhaust device resources before an error handler can report a fallback.
The export memory limit above remains a release priority.

## Outstanding validation and measurement

On 2026-10-17, all 29 unit tests, all 42 Chromium browser cases, and the production build passed.
Browser coverage uses desktop and phone screen sizes and includes legacy Color-study restoration and native SVG export. Palette regressions remain covered by pixel tests.
After simplifying the workspace, 15 targeted WebKit checks passed across phone, iPad portrait, and iPad landscape layouts.
The mobile review ran 54 WebKit scenarios across phone, iPad portrait, and iPad landscape layouts. Of those, 51 passed.
The three failures involved photo storage in temporary WebKit contexts. Persistent-context photo saving, reload, and reopening passed separately.
Production offline reload and fresh image processing also passed in WebKit.
Optional Firefox and desktop WebKit projects are configured through `STILL_ALL_BROWSERS=1`.
The mobile WebKit review used a temporary configuration. WebKit emulation does not substitute for physical Safari testing.

- [x] Run the complete Chromium browser suite at desktop and phone screen sizes.
- [ ] Test the main workflow in Safari and Firefox, including offline reload, local storage, and full-resolution export.
- [ ] Test camera capture, touch controls, home-screen installation, and PNG export on physical iPhone and iPad devices.
- [ ] Measure filter speed and memory use on older phones and tablets.
- [ ] Review simplification and comparison with artists using photographs of real paintings and references.

## Feature reference

The [Value Study feature page](https://valuestudy.app/en/features/) informed the plan reviewed on 2026-10-17.
Its selector, simplification, eyedropper, and color toggle overlap with Still's existing tools.
Still now also implements the four-group choice, histogram, grids, flip, optional outlines, and local gallery.
