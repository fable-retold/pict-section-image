# pict-section-image

A responsive **image viewer** section for the Retold/Pict ecosystem. Point it at an image URL and it fits the
whole image to its stage on phones, tablets, desktops, TVs, and projected displays — with a toolbar
(Fit / zoom / download) and click-to-zoom for inspecting detail. Above "fit" the stage scrolls, so panning is
native and touch-friendly.

It is a single [`pict-view`](https://github.com/fable-retold/pict-view) in the lightweight single-view shape
(like `pict-section-code`): a stub container template, with the viewer DOM built imperatively — an `<img>` is
inherently imperative (its `src`, natural dimensions, and `load`/`error` events have no template equivalent).

Usable on its own, or driven as the ordinary-image renderer inside
[`pict-section-fileview`](https://github.com/fable-retold/pict-section-fileview).

## Install

```bash
npm install pict-section-image
```

The only hard dependency is `pict-view`.

## Usage

```javascript
const libPictSectionImage = require('pict-section-image');

pict.addView('MyImage', Object.assign({}, libPictSectionImage.default_configuration,
    {
        DefaultDestinationAddress: '#SomeDiv',
        TargetElementAddress:      '#SomeDiv',
        ImageURL:                  'https://host/photo.jpg'
    }), libPictSectionImage);

pict.views.MyImage.render();

// …or point it at an image later:
pict.views.MyImage.setImage('https://host/other.png');
pict.views.MyImage.setImage({ URL: 'https://host/cat.png', AltText: 'A cat', Name: 'cat.png' });
```

### Configuration

| Key | Meaning |
|---|---|
| `ImageURL` | Initial image URL (or `false` for an empty viewer until `setImage()`). |
| `AltText` | `alt` text for the `<img>`. |
| `DownloadURL` / `DownloadName` | Explicit download href + filename hint (`DownloadURL` defaults to the image URL). |
| `ShowToolbar` | Render the Fit / zoom / download toolbar (default on). Set `false` when a host owns the chrome. |
| `ShowDownload` | Show the download affordance in the toolbar (default on). |
| `ShowFullscreen` | Show the maximize / restore button — fills the browser viewport and back; `Esc` exits (default on). |
| `ClickToZoom` | Clicking the image toggles fit ⇄ zoomed (default on). |
| `Checkerboard` | A subtle transparency checker behind the image so transparent PNGs read (default on). |
| `MinZoom` / `MaxZoom` / `ZoomStep` | Zoom bounds and step (defaults `1` / `8` / `0.5`). |
| `TargetElementAddress`, `DefaultDestinationAddress`, `RenderOnLoad` | Standard pict-view placement. |

### Public API

| Method | Does |
|---|---|
| `setImage(urlOrDescriptor)` | Point the viewer at an image; resets zoom to fit. |
| `zoomIn()` / `zoomOut()` | Step the zoom (zoom out at the floor returns to fit). |
| `fitImage()` | Reset to the fit (contain) presentation. |
| `toggleZoom()` | Flip between fit and zoomed. |
| `toggleFullscreen()` / `enterFullscreen()` / `exitFullscreen()` | Maximize the viewer to fill the browser viewport, and back. `Esc` also exits. |
| `isFullscreen()` | Whether the viewer is currently maximized. |
| `getState()` | `{ URL, Loaded, Error, Zoom, Fit, Fullscreen, NaturalWidth, NaturalHeight }`. |
| `destroy()` | Detach handlers and clear the viewer. |

### Zoom model

Zoom is a multiplier of the **fit** (contain) size: `1` fits the whole image with no scroll; above `1` the stage
scrolls so the reader can pan. When the image's natural size and the stage box are measurable (a real browser,
after the image loads) the zoomed image is sized in pixels from the fit size; otherwise it falls back to a
percentage width, so nothing throws in a headless or pre-layout context.

## Examples

`example_applications/image_viewer` is a runnable demo: four standalone viewers — a raster photo, a wide
panorama to zoom and pan, a tall PNG, and a vector SVG — each with its own Fit / zoom-in / zoom-out / download
toolbar, all independent on one page.

```bash
cd example_applications/image_viewer && npm run build   # build the example's browser bundle
npm run example-serve   # (from the module root) serve at http://localhost:<port>/image_viewer/dist/index.html
```

## Development

```bash
npm test        # Mocha TDD via quackage (real jsdom document)
npm run build   # browser bundle via quackage
```

MIT © Steven Velozo
