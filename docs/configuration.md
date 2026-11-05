# Configuration

```javascript
const libPictSectionImage = require('pict-section-image');

pict.addView('MyImage', Object.assign({}, libPictSectionImage.default_configuration,
    {
        DefaultDestinationAddress: '#SomeDiv',
        TargetElementAddress:      '#SomeDiv',
        ImageURL:                  'https://host/photo.jpg'
    }), libPictSectionImage);

pict.views.MyImage.render();
pict.views.MyImage.setImage({ URL: 'https://host/cat.png', AltText: 'A cat', Name: 'cat.png' });
```

## Options

| Key | Default | Meaning |
|---|---|---|
| `ImageURL` | `false` | Initial image URL (or `false` for an empty viewer until `setImage()`). |
| `AltText` | `''` | `alt` text for the `<img>`. |
| `DownloadURL` / `DownloadName` | `false` / `''` | Explicit download href + filename hint (`DownloadURL` defaults to the image URL). |
| `ShowToolbar` | `true` | Render the Fit / zoom / download toolbar. Set `false` when a host owns the chrome. |
| `ShowDownload` | `true` | Show the download affordance in the toolbar. |
| `ShowFullscreen` | `true` | Show the maximize / restore button (fills the browser viewport; `Esc` exits). |
| `ClickToZoom` | `true` | Clicking the image toggles fit ⇄ zoomed. |
| `Checkerboard` | `true` | A subtle transparency checker behind the image so transparent PNGs read. |
| `MinZoom` / `MaxZoom` / `ZoomStep` | `1` / `8` / `0.5` | Zoom bounds and step. |
| `TargetElementAddress`, `DefaultDestinationAddress`, `RenderOnLoad` | — | Standard `pict-view` placement. |

## Public API

| Method | Does |
|---|---|
| `setImage(urlOrDescriptor)` | Point the viewer at an image (`{ URL, AltText?, Name?, DownloadURL?, DownloadName? }`); resets zoom to fit. |
| `zoomIn()` / `zoomOut()` | Step the zoom (zoom out at the floor returns to fit). |
| `fitImage()` | Reset to the fit (contain) presentation. |
| `toggleZoom()` | Flip between fit and zoomed. |
| `toggleFullscreen()` / `enterFullscreen()` / `exitFullscreen()` / `isFullscreen()` | Fill the browser viewport, and back. |
| `getState()` | `{ URL, Loaded, Error, Zoom, Fit, Fullscreen, NaturalWidth, NaturalHeight }`. |
| `destroy()` | Detach handlers and clear the viewer. |

## Styling

All styling is the `.psi-*` CSS family, wired through `pict-provider-theme` tokens (`var(--theme-color-*,
fallback)`) and registered through the Pict CSS cascade. Append per-instance overrides via `CSSExtra`.
