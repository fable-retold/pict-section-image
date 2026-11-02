module.exports = (
{
	"RenderOnLoad": true,

	"DefaultRenderable": "ImageViewer-Wrap",
	"DefaultDestinationAddress": "#ImageViewer-Container-Div",

	"Templates":
	[
		{
			"Hash": "ImageViewer-Container",
			// A stub — the viewer DOM is built imperatively in onAfterInitialRender (an <img> is an inherently
			// imperative element: its src, natural dimensions and load/error events have no template equivalent).
			// This mirrors pict-section-code, which builds its CodeJar host the same way.
			"Template": "<!-- ImageViewer-Container rendering soon -->"
		}
	],

	"Renderables":
	[
		{
			"RenderableHash": "ImageViewer-Wrap",
			"TemplateHash": "ImageViewer-Container",
			"DestinationAddress": "#ImageViewer-Container-Div"
		}
	],

	// The element the viewer DOM is built into (defaults to the same div the stub renders into).
	"TargetElementAddress": "#ImageViewer-Container-Div",

	// The initial image: a URL string, or false for an empty viewer until setImage() is called.
	"ImageURL": false,
	// Alt text for the <img> (accessibility; also shown by the browser if the image fails).
	"AltText": "",
	// An explicit download href + filename hint. DownloadURL defaults to ImageURL.
	"DownloadURL": false,
	"DownloadName": "",

	// Chrome + behavior toggles.
	"ShowToolbar": true,      // the Fit / zoom / download toolbar above the image
	"ShowDownload": true,     // the download affordance in the toolbar
	"ShowFullscreen": true,   // the maximize/restore button (fills the browser viewport and back; Esc exits)
	"Checkerboard": true,     // a subtle transparency checker behind the image so transparent PNGs read
	"ClickToZoom": true,      // clicking the image toggles fit <-> zoomed

	// Zoom model: zoom is a multiplier of the fit (contain) size. 1 = fit the whole image (no scroll); above 1
	// the stage scrolls so the reader can pan (native scroll — touch- and mouse-friendly).
	"MinZoom": 1,
	"MaxZoom": 8,
	"ZoomStep": 0.5,

	"CSS": `.psi-root
{
	display: flex;
	flex-direction: column;
	min-height: 0;
	height: 100%;
	width: 100%;
	box-sizing: border-box;
	background: var(--theme-color-background-panel, #ffffff);
	color: var(--theme-color-text-primary, #1f2733);
}
/* Maximized: the viewer leaves its host box and fills the browser viewport. Esc or the toolbar button restores it. */
.psi-root.psi-fullscreen
{
	position: fixed;
	top: 0;
	right: 0;
	bottom: 0;
	left: 0;
	width: 100vw;
	height: 100vh;
	border-radius: 0;
	z-index: 2147483000;
}
.psi-toolbar
{
	display: flex;
	align-items: center;
	gap: 0.4rem;
	flex: 0 0 auto;
	padding: 0.4rem 0.6rem;
	border-bottom: 1px solid var(--theme-color-border-light, #e8ebf0);
	background: var(--theme-color-background-secondary, #f7f9fb);
}
.psi-spacer { flex: 1 1 auto; }
.psi-btn
{
	font-size: 0.8rem;
	font-weight: 600;
	padding: 0.3rem 0.62rem;
	border-radius: 6px;
	border: 1px solid var(--theme-color-border-medium, #d5dbe3);
	background: var(--theme-color-background-panel, #ffffff);
	color: var(--theme-color-text-secondary, #45505f);
	cursor: pointer;
	display: inline-flex;
	align-items: center;
	gap: 0.3rem;
	text-decoration: none;
	line-height: 1;
}
.psi-btn:hover { border-color: var(--theme-color-brand-primary, #5650e6); color: var(--theme-color-text-primary, #1f2733); text-decoration: none; }
.psi-btn[disabled] { opacity: 0.45; cursor: default; }
.psi-zoom-label { font-size: 0.78rem; color: var(--theme-color-text-muted, #6b7686); min-width: 3rem; text-align: center; user-select: none; }
.psi-stage
{
	position: relative;
	flex: 1 1 auto;
	min-height: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
}
.psi-stage.psi-scroll { overflow: auto; align-items: flex-start; justify-content: flex-start; }
/* A subtle, theme-neutral transparency checker (reads on both light and dark panels). */
.psi-stage.psi-checker
{
	background-color: var(--theme-color-background-panel, #ffffff);
	background-image:
		linear-gradient(45deg, rgba(128, 128, 128, 0.12) 25%, transparent 25%),
		linear-gradient(-45deg, rgba(128, 128, 128, 0.12) 25%, transparent 25%),
		linear-gradient(45deg, transparent 75%, rgba(128, 128, 128, 0.12) 75%),
		linear-gradient(-45deg, transparent 75%, rgba(128, 128, 128, 0.12) 75%);
	background-size: 20px 20px;
	background-position: 0 0, 0 10px, 10px -10px, -10px 0;
}
.psi-image { display: block; }
.psi-stage.psi-fit .psi-image { max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; cursor: zoom-in; }
.psi-stage.psi-scroll .psi-image { cursor: zoom-out; }
.psi-loading, .psi-error
{
	margin: auto;
	text-align: center;
	color: var(--theme-color-text-muted, #8a94a3);
	padding: 1.6rem 1rem;
	font-size: 0.9rem;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.55rem;
}
.psi-error-glyph { font-size: 1.8rem; opacity: 0.6; }
`
});
