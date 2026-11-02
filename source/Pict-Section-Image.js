const libPictViewClass = require('pict-view');
const _DefaultConfiguration = require('./Pict-Section-Image-DefaultConfiguration.js');

/**
 * pict-section-image — a responsive image viewer section.
 *
 * Drop it on a page, point it at an image URL, and it fits the whole image to the stage on phones, tablets,
 * desktops and projected displays. A toolbar (Fit / zoom out / zoom in / download) and click-to-zoom let the
 * reader inspect detail; above "fit" the stage scrolls so panning is native (touch- and mouse-friendly).
 *
 * It is a single pict-view in the "code.js" shape (like pict-section-code): a stub container template, with the
 * viewer DOM built imperatively in onAfterInitialRender — an <img> is inherently imperative (src, natural
 * dimensions, and the load/error events have no template equivalent).
 *
 * Standalone, or driven as the ordinary-image renderer inside pict-section-fileview: the fileview delegate
 * mounts it with ShowToolbar:false (fileview owns the chrome) and feeds files through setImage().
 *
 * Zoom model: zoom is a multiplier of the fit (contain) size. 1 = fit the whole image, no scroll; above 1 the
 * stage scrolls. When the image's natural size and the stage box are measurable (a real browser, after load)
 * the zoomed <img> is sized in pixels from the fit size; when they are not (headless), it falls back to a
 * percentage width so nothing throws.
 *
 * Event wiring note: the toolbar buttons and the <img> (load / error / click) use element-property handlers
 * (`el.onclick = ...`), not addEventListener and not template inline handlers. The pict rule against
 * addEventListener is about listeners silently lost on template re-render; this widget is built once
 * imperatively and never re-rendered by the template engine, element-property handlers cannot duplicate, and
 * the <img>'s load/error/natural-size have no template-handler equivalent — the same programmatic-element
 * exception pict-section-code documents for its editor observers.
 */
class PictSectionImage extends libPictViewClass
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, _DefaultConfiguration, pOptions);
		super(pFable, tmpOptions, pServiceHash);

		this.initialRenderComplete = false;

		// DOM handles — built once in onAfterInitialRender.
		this.targetElement = false;
		this._rootElement = null;
		this._stageElement = null;
		this._imageElement = null;
		this._loadingElement = null;
		this._zoomLabelElement = null;
		this._downloadElement = null;
		this._fullscreenButtonElement = null;

		// Fullscreen (fill-the-viewport) state + the document Escape handler installed only while maximized.
		this._fullscreen = false;
		this._keydownHandler = null;

		// View state.
		this._url = this.options.ImageURL || '';
		this._altText = this.options.AltText || '';
		this._downloadURL = this.options.DownloadURL || '';
		this._downloadName = this.options.DownloadName || '';
		this._zoom = 1;
		this._loaded = false;
		this._error = false;
		this._naturalWidth = 0;
		this._naturalHeight = 0;

		this._minZoom = (typeof this.options.MinZoom === 'number' && this.options.MinZoom > 0) ? this.options.MinZoom : 1;
		this._maxZoom = (typeof this.options.MaxZoom === 'number' && this.options.MaxZoom > this._minZoom) ? this.options.MaxZoom : 8;
		this._zoomStep = (typeof this.options.ZoomStep === 'number' && this.options.ZoomStep > 0) ? this.options.ZoomStep : 0.5;
	}

	onBeforeInitialize()
	{
		super.onBeforeInitialize();
		this.targetElement = false;
	}

	onAfterRender(pRenderable)
	{
		// Ensure the CSS from all registered views is injected (pict rule for lazy-rendered views).
		this.pict.CSSMap.injectCSS();

		// Build the viewer when it isn't present — the first render, or a host re-render that re-stamped the stub
		// container template over our built DOM. Instance state (_url, _zoom) persists, so a rebuild re-loads the
		// current image; this makes a re-render self-healing rather than silently wiping the viewer.
		if (!this._viewerPresent())
		{
			this.onAfterInitialRender();
			this.initialRenderComplete = true;
		}

		return super.onAfterRender(pRenderable);
	}

	/** Is the viewer DOM currently present in the target (false after the first render or a stub re-stamp)? */
	_viewerPresent()
	{
		return !!this._queryOwned('#' + this.Hash + '-Stage');
	}

	onAfterInitialRender()
	{
		let tmpTargetElementSet = this.services.ContentAssignment.getElement(this.options.TargetElementAddress);
		if (!tmpTargetElementSet || tmpTargetElementSet.length < 1)
		{
			this.log.error(`PICT-Image Could not find target element [${this.options.TargetElementAddress}]!`);
			this.targetElement = false;
			return false;
		}
		this.targetElement = tmpTargetElementSet[0];

		this._buildViewerDOM();

		if (this._url)
		{
			this._loadImage(this._url);
		}
		else
		{
			this._present();
		}
	}

	// -----------------------------------------------------------------------------------------------------------
	// DOM construction (once)
	// -----------------------------------------------------------------------------------------------------------

	/**
	 * Build the viewer chrome into the target element, then grab references and wire the element-property
	 * handlers. Called once from onAfterInitialRender.
	 */
	_buildViewerDOM()
	{
		const tmpBase = this.Hash;
		const tmpCheckerClass = this.options.Checkerboard ? ' psi-checker' : '';

		// Make sure the maximize/restore glyphs exist in the icon registry before the toolbar references them.
		this._ensureIcons();

		let tmpToolbar = '';
		if (this.options.ShowToolbar)
		{
			let tmpDownload = '';
			if (this.options.ShowDownload)
			{
				tmpDownload = '<a class="psi-btn psi-download" id="' + tmpBase + '-Download" style="display:none" href="#" download>'
					+ this._icon('Download') + 'Download</a>';
			}
			let tmpFullscreen = '';
			if (this.options.ShowFullscreen)
			{
				tmpFullscreen = '<button type="button" class="psi-btn psi-fullscreen-btn" id="' + tmpBase + '-FullscreenBtn" title="Full screen">'
					+ this._icon(this._fullscreen ? 'Minimize' : 'Maximize') + '</button>';
			}
			tmpToolbar = '<div class="psi-toolbar" id="' + tmpBase + '-Toolbar">'
				+ '<button type="button" class="psi-btn" id="' + tmpBase + '-FitBtn" title="Fit image">' + this._icon('Search') + 'Fit</button>'
				+ '<button type="button" class="psi-btn" id="' + tmpBase + '-ZoomOutBtn" title="Zoom out">&minus;</button>'
				+ '<span class="psi-zoom-label" id="' + tmpBase + '-ZoomLabel">Fit</span>'
				+ '<button type="button" class="psi-btn" id="' + tmpBase + '-ZoomInBtn" title="Zoom in">+</button>'
				+ '<span class="psi-spacer"></span>'
				+ tmpFullscreen
				+ tmpDownload
				+ '</div>';
		}

		const tmpHTML = '<div class="psi-root" id="' + tmpBase + '-Root">'
			+ tmpToolbar
			+ '<div class="psi-stage psi-fit' + tmpCheckerClass + '" id="' + tmpBase + '-Stage">'
			+ '<div class="psi-loading" id="' + tmpBase + '-Loading">' + this._icon('Image') + ' Loading…</div>'
			+ '<img class="psi-image" id="' + tmpBase + '-Image" alt="' + this._esc(this._altText) + '" style="display:none" />'
			+ '</div>'
			+ '</div>';

		this.pict.ContentAssignment.assignContent(this.options.TargetElementAddress, tmpHTML);

		// Reference grab (querySelector within the owned subtree is fine — these are nodes we just built).
		this._rootElement = this._queryOwned('#' + tmpBase + '-Root');
		this._stageElement = this._queryOwned('#' + tmpBase + '-Stage');
		this._imageElement = this._queryOwned('#' + tmpBase + '-Image');
		this._loadingElement = this._queryOwned('#' + tmpBase + '-Loading');
		this._zoomLabelElement = this._queryOwned('#' + tmpBase + '-ZoomLabel');
		this._downloadElement = this._queryOwned('#' + tmpBase + '-Download');
		this._fullscreenButtonElement = this._queryOwned('#' + tmpBase + '-FullscreenBtn');

		// Image load / error / click — element-property handlers (see the class note).
		if (this._imageElement)
		{
			let tmpSelf = this;
			this._imageElement.onload = function () { tmpSelf._onImageLoad(); };
			this._imageElement.onerror = function () { tmpSelf._onImageError(); };
			if (this.options.ClickToZoom)
			{
				this._imageElement.onclick = function () { tmpSelf.toggleZoom(); };
			}
		}

		// Toolbar buttons.
		if (this.options.ShowToolbar)
		{
			let tmpSelf = this;
			let tmpFit = this._queryOwned('#' + tmpBase + '-FitBtn');
			let tmpOut = this._queryOwned('#' + tmpBase + '-ZoomOutBtn');
			let tmpIn = this._queryOwned('#' + tmpBase + '-ZoomInBtn');
			if (tmpFit) { tmpFit.onclick = function () { tmpSelf.fitImage(); }; }
			if (tmpOut) { tmpOut.onclick = function () { tmpSelf.zoomOut(); }; }
			if (tmpIn) { tmpIn.onclick = function () { tmpSelf.zoomIn(); }; }
			if (this._fullscreenButtonElement) { this._fullscreenButtonElement.onclick = function () { tmpSelf.toggleFullscreen(); }; }
		}

		// If a host re-render re-stamped the stub over a maximized viewer, the rebuilt root lost the class —
		// re-apply it so the rebuild stays in fullscreen (instance state persists). The Escape handler lives on
		// document, so it survives the rebuild and needs no re-attaching.
		if (this._fullscreen && this._rootElement)
		{
			this._rootElement.classList.add('psi-fullscreen');
		}
	}

	/** querySelector scoped to the viewer subtree, via ContentAssignment, returning the element or null. */
	_queryOwned(pSelector)
	{
		let tmpSet = this.services.ContentAssignment.getElement(pSelector);
		return (tmpSet && tmpSet.length > 0) ? tmpSet[0] : null;
	}

	// -----------------------------------------------------------------------------------------------------------
	// Image loading
	// -----------------------------------------------------------------------------------------------------------

	_loadImage(pURL)
	{
		this._loaded = false;
		this._error = false;
		this._naturalWidth = 0;
		this._naturalHeight = 0;

		// Recover from a prior error: _paintErrorState replaced the stage contents and dropped the <img>, so
		// rebuild the viewer DOM (which recreates a fresh <img> + loading element) before loading.
		if (!this._imageElement && this.targetElement)
		{
			this._buildViewerDOM();
		}
		if (!this._imageElement)
		{
			return;
		}

		// Show the loading state; hide the image until it decodes.
		this._setLoadingVisible(true);
		this._imageElement.style.display = 'none';
		this._imageElement.setAttribute('alt', this._altText || '');

		if (!pURL)
		{
			// Nothing to show — leave the (empty) loading state cleared.
			this._setLoadingVisible(false);
			return;
		}

		// Assigning src kicks the browser's fetch/decode; onload / onerror drive the rest.
		this._imageElement.src = pURL;

		// Guard: a cached image can be complete synchronously with no load event. Detect it.
		if (this._imageElement.complete && this._imageElement.naturalWidth > 0)
		{
			this._onImageLoad();
		}
	}

	_onImageLoad()
	{
		this._loaded = true;
		this._error = false;
		this._naturalWidth = this._imageElement ? (this._imageElement.naturalWidth || 0) : 0;
		this._naturalHeight = this._imageElement ? (this._imageElement.naturalHeight || 0) : 0;
		this._setLoadingVisible(false);
		if (this._imageElement) { this._imageElement.style.display = 'block'; }
		this._present();
	}

	_onImageError()
	{
		this._loaded = false;
		this._error = true;
		this._setLoadingVisible(false);
		if (this._imageElement) { this._imageElement.style.display = 'none'; }
		this._paintErrorState();
	}

	_setLoadingVisible(pVisible)
	{
		if (this._loadingElement) { this._loadingElement.style.display = pVisible ? 'flex' : 'none'; }
	}

	_paintErrorState()
	{
		if (!this._stageElement) { return; }
		let tmpDownload = '';
		if ((this._downloadURL || this._url))
		{
			tmpDownload = '<a class="psi-btn" href="' + this._esc(this._downloadURL || this._url) + '" download'
				+ (this._downloadName ? ('="' + this._esc(this._downloadName) + '"') : '')
				+ '>' + this._icon('Download') + 'Download</a>';
		}
		const tmpBase = this.Hash;
		this.pict.ContentAssignment.assignContent('#' + tmpBase + '-Stage',
			'<div class="psi-error"><span class="psi-error-glyph">' + this._icon('Image') + '</span>'
			+ '<p>This image could not be displayed.</p>' + tmpDownload + '</div>');
		// The <img> node was replaced by the error block; drop stale references so a later setImage rebuilds.
		this._imageElement = null;
		this._loadingElement = null;
	}

	// -----------------------------------------------------------------------------------------------------------
	// Presentation (fit vs. zoom)
	// -----------------------------------------------------------------------------------------------------------

	/** Lay out the image for the current zoom + state, and refresh the toolbar. */
	_present()
	{
		if (!this._stageElement || !this._imageElement) { return; }
		if (this._error || !this._loaded) { this._refreshToolbar(); return; }

		const tmpScrolled = this._zoom > this._minZoom;

		this._stageElement.classList.remove('psi-fit');
		this._stageElement.classList.remove('psi-scroll');
		this._stageElement.classList.add(tmpScrolled ? 'psi-scroll' : 'psi-fit');

		if (!tmpScrolled)
		{
			// Fit: let the CSS (max-width/height:100%, object-fit:contain) size the image.
			this._imageElement.style.width = '';
			this._imageElement.style.height = '';
			this._imageElement.style.maxWidth = '';
			this._imageElement.style.maxHeight = '';
		}
		else
		{
			const tmpFit = this._computeFitSize();
			if (tmpFit)
			{
				this._imageElement.style.width = Math.round(tmpFit.Width * this._zoom) + 'px';
				this._imageElement.style.height = Math.round(tmpFit.Height * this._zoom) + 'px';
			}
			else
			{
				// Headless / pre-layout fallback: a percentage width still scrolls in a real browser and never throws.
				this._imageElement.style.width = Math.round(this._zoom * 100) + '%';
				this._imageElement.style.height = 'auto';
			}
			this._imageElement.style.maxWidth = 'none';
			this._imageElement.style.maxHeight = 'none';
		}

		this._refreshToolbar();
	}

	/**
	 * The contain (fit) size of the image within the stage, or null when it can't be measured (no natural size
	 * yet, or a zero-size stage as in a headless test). "Fit" never upscales past natural size.
	 * @returns {({Width:number,Height:number}|null)}
	 */
	_computeFitSize()
	{
		if (!this._stageElement || !this._naturalWidth || !this._naturalHeight) { return null; }
		const tmpStageWidth = this._stageElement.clientWidth;
		const tmpStageHeight = this._stageElement.clientHeight;
		if (!tmpStageWidth || !tmpStageHeight) { return null; }
		const tmpScale = Math.min(tmpStageWidth / this._naturalWidth, tmpStageHeight / this._naturalHeight, 1);
		return { Width: this._naturalWidth * tmpScale, Height: this._naturalHeight * tmpScale };
	}

	_refreshToolbar()
	{
		if (this._zoomLabelElement)
		{
			this._zoomLabelElement.textContent = (this._zoom > this._minZoom) ? (Math.round(this._zoom * 100) + '%') : 'Fit';
		}
		if (this._downloadElement)
		{
			const tmpHref = this._downloadURL || this._url;
			if (tmpHref)
			{
				this._downloadElement.setAttribute('href', tmpHref);
				if (this._downloadName) { this._downloadElement.setAttribute('download', this._downloadName); }
				this._downloadElement.style.display = 'inline-flex';
			}
			else
			{
				this._downloadElement.style.display = 'none';
			}
		}
	}

	// -----------------------------------------------------------------------------------------------------------
	// Public API
	// -----------------------------------------------------------------------------------------------------------

	/**
	 * Point the viewer at an image. Accepts a URL string or a descriptor object
	 * ({ URL, AltText?, Name?, DownloadURL?, DownloadName? }). Resets zoom to fit.
	 * @param {(string|Object)} pInput
	 */
	setImage(pInput)
	{
		let tmpURL = '';
		let tmpAlt = this._altText;
		let tmpDownloadURL = '';
		let tmpDownloadName = '';

		if (typeof pInput === 'string')
		{
			tmpURL = pInput;
		}
		else if (pInput && typeof pInput === 'object')
		{
			tmpURL = pInput.URL || pInput.Url || pInput.ImageURL || '';
			tmpAlt = pInput.AltText || pInput.Alt || pInput.Name || this._altText;
			tmpDownloadURL = pInput.DownloadURL || '';
			tmpDownloadName = pInput.DownloadName || pInput.Name || '';
		}

		this._url = tmpURL;
		this._altText = tmpAlt || '';
		this._downloadURL = tmpDownloadURL || tmpURL;
		this._downloadName = tmpDownloadName || '';
		this._zoom = 1;

		if (this.targetElement)
		{
			this._loadImage(tmpURL);
		}
	}

	/** Zoom in one step (switches from fit to a scrolling, zoomed presentation). */
	zoomIn()
	{
		if (!this._loaded) { return; }
		this._zoom = Math.min(this._maxZoom, this._zoom + this._zoomStep);
		this._present();
	}

	/** Zoom out one step; at or below the floor the image returns to fit (no scroll). */
	zoomOut()
	{
		if (!this._loaded) { return; }
		this._zoom = this._zoom - this._zoomStep;
		if (this._zoom < this._minZoom) { this._zoom = this._minZoom; }
		this._present();
	}

	/** Reset to the fit (contain) presentation. */
	fitImage()
	{
		this._zoom = this._minZoom;
		this._present();
	}

	/** Clicking the image toggles between fit and a zoomed-in presentation. */
	toggleZoom()
	{
		if (!this._loaded) { return; }
		if (this._zoom > this._minZoom)
		{
			this._zoom = this._minZoom;
		}
		else
		{
			this._zoom = Math.min(this._maxZoom, this._minZoom + (this._zoomStep * 2));
		}
		this._present();
	}

	// -----------------------------------------------------------------------------------------------------------
	// Fullscreen — fill the browser viewport, and back
	// -----------------------------------------------------------------------------------------------------------

	/** Toggle the maximized (fill-the-viewport) presentation. */
	toggleFullscreen()
	{
		if (this._fullscreen) { this.exitFullscreen(); } else { this.enterFullscreen(); }
	}

	/** Maximize: lift the viewer out of its host box to fill the browser viewport (Esc or the button restores it). */
	enterFullscreen()
	{
		if (this._fullscreen) { return; }
		this._fullscreen = true;
		if (this._rootElement) { this._rootElement.classList.add('psi-fullscreen'); }
		this._installEscapeHandler();
		this._refreshFullscreenButton();
		// The stage just changed size — re-fit (or re-measure the zoomed layout) against the new viewport box.
		this._present();
	}

	/** Restore the viewer to its host box. */
	exitFullscreen()
	{
		if (!this._fullscreen) { return; }
		this._fullscreen = false;
		if (this._rootElement) { this._rootElement.classList.remove('psi-fullscreen'); }
		this._removeEscapeHandler();
		this._refreshFullscreenButton();
		this._present();
	}

	/** Is the viewer currently maximized? */
	isFullscreen()
	{
		return this._fullscreen;
	}

	/** Swap the maximize/restore glyph + title to match the current state. */
	_refreshFullscreenButton()
	{
		if (!this._fullscreenButtonElement) { return; }
		this._fullscreenButtonElement.innerHTML = this._icon(this._fullscreen ? 'Minimize' : 'Maximize');
		this._fullscreenButtonElement.setAttribute('title', this._fullscreen ? 'Exit full screen' : 'Full screen');
	}

	/**
	 * Install a document-level Escape handler while maximized. A document keydown listener is the documented
	 * pict exception (a browser-level event with no element-level inline equivalent — the image need not be
	 * focused for Escape to work). It is added only while fullscreen and removed on exit / destroy.
	 */
	_installEscapeHandler()
	{
		if (this._keydownHandler || (typeof document === 'undefined') || (typeof document.addEventListener !== 'function')) { return; }
		let tmpSelf = this;
		this._keydownHandler = function (pEvent)
		{
			if (pEvent && pEvent.key === 'Escape' && tmpSelf._fullscreen) { tmpSelf.exitFullscreen(); }
		};
		document.addEventListener('keydown', this._keydownHandler);
	}

	/** Remove the document-level Escape handler. */
	_removeEscapeHandler()
	{
		if (this._keydownHandler && (typeof document !== 'undefined') && (typeof document.removeEventListener === 'function'))
		{
			document.removeEventListener('keydown', this._keydownHandler);
		}
		this._keydownHandler = null;
	}

	/** Register the maximize / restore glyphs in the icon registry (idempotent; no-op without an Icon provider). */
	_ensureIcons()
	{
		if (!this.pict || !this.pict.providers || !this.pict.providers.Icon || (typeof this.pict.providers.Icon.registerSet !== 'function')) { return; }
		this.pict.providers.Icon.registerSet(
		{
			Outline:
			{
				Maximize: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
				Minimize: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>'
			}
		});
	}

	/** A snapshot of the viewer's current state (handy for hosts and tests). */
	getState()
	{
		return (
		{
			URL: this._url,
			Loaded: this._loaded,
			Error: this._error,
			Zoom: this._zoom,
			Fit: (this._zoom <= this._minZoom),
			Fullscreen: this._fullscreen,
			NaturalWidth: this._naturalWidth,
			NaturalHeight: this._naturalHeight
		});
	}

	/** Tear down handlers and clear the viewer. */
	destroy()
	{
		// Drop the document Escape handler (it outlives the viewer DOM otherwise) and leave fullscreen state clean.
		this._removeEscapeHandler();
		this._fullscreen = false;

		if (this._imageElement)
		{
			this._imageElement.onload = null;
			this._imageElement.onerror = null;
			this._imageElement.onclick = null;
			this._imageElement.removeAttribute('src');
		}
		if (this._fullscreenButtonElement) { this._fullscreenButtonElement.onclick = null; }
		if (this.targetElement && this.pict && this.pict.ContentAssignment)
		{
			this.pict.ContentAssignment.assignContent(this.options.TargetElementAddress, '');
		}
		this._rootElement = null;
		this._stageElement = null;
		this._imageElement = null;
		this._loadingElement = null;
		this._zoomLabelElement = null;
		this._downloadElement = null;
		this._fullscreenButtonElement = null;
	}

	// -----------------------------------------------------------------------------------------------------------
	// Small utilities
	// -----------------------------------------------------------------------------------------------------------

	/** A themable glyph from the icon registry; '' when no registry is present. */
	_icon(pName)
	{
		if (!this.pict || (typeof this.pict.icon !== 'function')) { return ''; }
		try { return this.pict.icon(pName); }
		catch (pError) { return ''; }
	}

	/** Escape HTML metacharacters for safe interpolation into built markup. */
	_esc(pText)
	{
		if (pText === null || typeof pText === 'undefined') { return ''; }
		return String(pText)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}
}

module.exports = PictSectionImage;

module.exports.default_configuration = _DefaultConfiguration;
