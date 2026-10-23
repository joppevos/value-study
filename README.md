# Still

Still helps artists study a photograph before their next brushstroke.
Open a reference or a photo of your painting to study its large shapes.
Use Still beside your easel or sketchbook on a phone, iPad, or computer.

[Open Still in your browser](https://joppevos.github.io/value-study/).
No account or installation is required.

## Use Still

Value means how light or dark a color appears.
Value groups divide the photograph into a few gray shades.
They help you see where light and dark shapes meet.
PNG is an image file format.

To start a study:

1. Open a photograph with Choose image or Take a photo.
2. Choose Full or 2, 3, 4, 5, or 7 value groups.
3. Press and hold `Hold to see original` to compare your study with the photograph.
4. Press and hold `Hold to squint` to see the image at a smaller size.
5. Enable Sample colors to compare two areas of the photograph.
6. Select Save study to download the processed image as a PNG file.

Each color sample averages a small area of the image.
Select Pin as A to keep one sample, then tap another area to compare it.
The comparison describes the photograph, not exact measurements of physical paint.

You can also use these tools:

- Select a value group to isolate its shapes.
- Adjust value boundaries to change where the groups meet.
- Use Detail smoothing to remove small details.
- Open Adjust light & shadow for brightness and contrast.
- Select Center or Thirds beside Grid beneath the image.
- Use Undo, Redo, or Reset to revisit a decision.
- Open Compare photos & save studies for a second photograph, saved variations, and local storage.

Color view keeps the photograph in color while Detail smoothing removes small details.
Switch between Color and Value to compare color shapes with light and dark shapes.
Value groups stay saved when you switch views.

Chroma means how muted or intense a color appears.
Chroma view shows neutral areas as dark and intense areas as light.
Its light areas do not represent light values in the photograph.

## Sample a photo value

Select Sample value, then press or drag across the image.
The gray scale highlights the nearest swatch and keeps the reading after release.
Use arrow keys on the image to move the sample point.

The estimated Munsell value runs from 0 for black to 10 for white.
The default scale shows 11 swatches, including both endpoints.
Scale steps changes the swatch count without changing the reading or the value groups.

Original photo is the default sample source.
Processed study samples the result after adjustments instead.
Each sample averages light from an area of up to 5 × 5 pixels.

The estimate assumes sRGB, a standard format for screen colors.
It uses the [Munsell value and luminance relationship](https://colour.readthedocs.io/en/latest/_modules/colour/colorimetry/luminance.html#luminance_ASTMD1535).
It differs from the existing 0–100 grayscale reading and does not measure physical paint.

## Your photographs

Still processes photographs on your device and does not upload them.
Saved studies contain adjustments only unless you select Include the original photo.
Remember adjustments between visits saves no photographs.

Browser storage can be cleared or reach its limit.
Export PNG copies of work that you want to keep.
After the app reports that its offline copy is ready, you can reopen it without an internet connection.

## Project status

Still is a beta app.
Automated tests cover image processing and browser behavior at desktop, phone, and iPad screen sizes.
Physical iPhone and iPad testing remains open.
Large exports at the original image size can use too much device memory.

Controls that reduce the number of colors remain deferred.
Some results gave confusing color relationships in green images and skin tones.
The simple Color view uses detail smoothing without reducing the image to a fixed number of colors.
The reason for this decision is in [AGENTS.md](AGENTS.md), and planned work is in [TODO.md](TODO.md).

## Run Still locally

Use Node.js 18 or later and npm.
Download or clone this repository before you start.
In a terminal, open the repository folder and run:

```sh
npm install
npm run dev
```

Open the address that Vite prints in the terminal.
For a phone or tablet, connect the device to the same network as your computer.
On that device, open the network address that Vite prints.
Camera behavior depends on the browser and device.

## Develop and test

The app uses JavaScript, Vite, and Canvas to draw images.
Image processing runs separately from the main browser interface.
The working preview uses at most 1600 pixels on its longest side.

From the repository folder, run the image tests and build the app:

```sh
npm test
npm run build
```

The build writes the app files to `dist`.
To serve those files locally, run `npm run preview`.
The preview address appears in the terminal.

Playwright runs the browser tests.
For the default browser tests, install Chromium first.
From the repository folder, run:

```sh
npx playwright install chromium
npm run test:e2e
```

GitHub Actions publishes successful builds to GitHub Pages after pushes to `main`.
For a local deployment test, build with the GitHub Pages path first.
From the repository folder, run these commands after Chromium is installed:

```sh
STILL_BASE_PATH=/value-study/ npm run build
npm run test:pages
```

Browser tests do not replace tests on physical devices.
Before proposing a feature, read the product principles in [AGENTS.md](AGENTS.md).
For a bug report, include the device, browser, steps, and expected result in a [GitHub issue](https://github.com/joppevos/value-study/issues).
