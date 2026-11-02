/*
	Unit tests for Pict-Section-Image

	These run against a real jsdom document (browser-env, no mocked ContentAssignment) so the <img> element,
	the fit/scroll stage classes, and the load/error paths are genuinely exercised.
*/

const libBrowserEnv = require('browser-env');
libBrowserEnv();

const Chai = require('chai');
const Expect = Chai.expect;

const libPict = require('pict');
const libPictSectionImage = require('../source/Pict-Section-Image.js');

let _HostSerial = 0;

/**
 * Stand up a pict app with a real host div and a mounted image view. Returns { pict, view, hostId }.
 * The view is rendered once (RenderOnLoad:false + explicit render()).
 */
function buildView(pConfigOverrides)
{
	const tmpHostId = 'ImageHost' + (++_HostSerial);
	const tmpHost = document.createElement('div');
	tmpHost.id = tmpHostId;
	document.body.appendChild(tmpHost);

	const tmpPict = new libPict();
	const tmpViewHash = 'TestImage' + _HostSerial;

	const tmpConfig = Object.assign({}, libPictSectionImage.default_configuration,
	{
		RenderOnLoad: false,
		DefaultDestinationAddress: '#' + tmpHostId,
		TargetElementAddress: '#' + tmpHostId,
		Renderables: [ { RenderableHash: 'ImageViewer-Wrap', TemplateHash: 'ImageViewer-Container', DestinationAddress: '#' + tmpHostId } ]
	}, pConfigOverrides || {});

	tmpPict.addView(tmpViewHash, tmpConfig, libPictSectionImage);
	const tmpView = tmpPict.views[tmpViewHash];
	tmpView.render();

	return { pict: tmpPict, view: tmpView, hostId: tmpHostId, viewHash: tmpViewHash };
}

/** Fake an image having decoded at a given natural size, then fire its load handler. */
function simulateLoad(pView, pWidth, pHeight)
{
	const tmpImage = pView._imageElement;
	Object.defineProperty(tmpImage, 'naturalWidth', { configurable: true, value: pWidth || 0 });
	Object.defineProperty(tmpImage, 'naturalHeight', { configurable: true, value: pHeight || 0 });
	Object.defineProperty(tmpImage, 'complete', { configurable: true, value: true });
	if (typeof tmpImage.onload === 'function') { tmpImage.onload(); }
}

/** Stub a stage element's measured client box (jsdom has no layout). */
function stubStageBox(pView, pWidth, pHeight)
{
	Object.defineProperty(pView._stageElement, 'clientWidth', { configurable: true, value: pWidth });
	Object.defineProperty(pView._stageElement, 'clientHeight', { configurable: true, value: pHeight });
}

suite
(
	'PictSectionImage',
	() =>
	{
		suite
		(
			'Module Exports',
			() =>
			{
				test('Main class should be exported', (fDone) =>
				{
					Expect(libPictSectionImage).to.be.a('function');
					return fDone();
				});
				test('Default configuration should be exported with the viewer keys', (fDone) =>
				{
					const tmpConfiguration = libPictSectionImage.default_configuration;
					Expect(tmpConfiguration).to.be.an('object');
					Expect(tmpConfiguration).to.have.property('DefaultRenderable');
					Expect(tmpConfiguration).to.have.property('TargetElementAddress');
					Expect(tmpConfiguration).to.have.property('MaxZoom');
					Expect(tmpConfiguration).to.have.property('CSS');
					return fDone();
				});
			}
		);

		suite
		(
			'Rendering the chrome',
			() =>
			{
				test('builds the stage and a hidden <img> into the target', (fDone) =>
				{
					const tmpHarness = buildView();
					Expect(document.getElementById(tmpHarness.viewHash + '-Stage')).to.not.equal(null);
					const tmpImage = document.getElementById(tmpHarness.viewHash + '-Image');
					Expect(tmpImage).to.not.equal(null);
					Expect(tmpImage.tagName.toLowerCase()).to.equal('img');
					Expect(tmpImage.style.display).to.equal('none');
					return fDone();
				});
				test('renders the toolbar by default', (fDone) =>
				{
					const tmpHarness = buildView();
					Expect(document.getElementById(tmpHarness.viewHash + '-Toolbar')).to.not.equal(null);
					Expect(document.getElementById(tmpHarness.viewHash + '-ZoomInBtn')).to.not.equal(null);
					Expect(document.getElementById(tmpHarness.viewHash + '-ZoomOutBtn')).to.not.equal(null);
					Expect(document.getElementById(tmpHarness.viewHash + '-FitBtn')).to.not.equal(null);
					return fDone();
				});
				test('omits the toolbar when ShowToolbar is false', (fDone) =>
				{
					const tmpHarness = buildView({ ShowToolbar: false });
					Expect(document.getElementById(tmpHarness.viewHash + '-Toolbar')).to.equal(null);
					// The stage is still built.
					Expect(document.getElementById(tmpHarness.viewHash + '-Stage')).to.not.equal(null);
					return fDone();
				});
				test('a re-render self-heals the viewer DOM after the stub template re-stamps', (fDone) =>
				{
					const tmpHarness = buildView();
					// Simulate a host re-render stamping the stub back over our viewer.
					tmpHarness.pict.ContentAssignment.assignContent('#' + tmpHarness.hostId, '<!-- stub -->');
					Expect(document.getElementById(tmpHarness.viewHash + '-Stage')).to.equal(null);
					tmpHarness.view.render();
					Expect(document.getElementById(tmpHarness.viewHash + '-Stage')).to.not.equal(null);
					return fDone();
				});
			}
		);

		suite
		(
			'Loading an image',
			() =>
			{
				test('setImage assigns the src and shows the loading state', (fDone) =>
				{
					const tmpHarness = buildView();
					tmpHarness.view.setImage('https://host/picture.png');
					Expect(tmpHarness.view._imageElement.getAttribute('src')).to.equal('https://host/picture.png');
					Expect(tmpHarness.view._loadingElement.style.display).to.equal('flex');
					Expect(tmpHarness.view.getState().Loaded).to.equal(false);
					return fDone();
				});
				test('on load, the image shows, loading hides, and state reflects natural size', (fDone) =>
				{
					const tmpHarness = buildView();
					tmpHarness.view.setImage('https://host/picture.png');
					simulateLoad(tmpHarness.view, 800, 600);
					const tmpState = tmpHarness.view.getState();
					Expect(tmpState.Loaded).to.equal(true);
					Expect(tmpState.Error).to.equal(false);
					Expect(tmpState.NaturalWidth).to.equal(800);
					Expect(tmpState.NaturalHeight).to.equal(600);
					Expect(tmpHarness.view._imageElement.style.display).to.equal('block');
					Expect(tmpHarness.view._loadingElement.style.display).to.equal('none');
					Expect(tmpHarness.view._stageElement.classList.contains('psi-fit')).to.equal(true);
					return fDone();
				});
				test('seeds the initial image from config ImageURL', (fDone) =>
				{
					const tmpHarness = buildView({ ImageURL: 'https://host/seed.jpg' });
					Expect(tmpHarness.view._imageElement.getAttribute('src')).to.equal('https://host/seed.jpg');
					return fDone();
				});
				test('reveals the toolbar download affordance once a URL is set', (fDone) =>
				{
					const tmpHarness = buildView();
					Expect(tmpHarness.view._downloadElement.style.display).to.equal('none');
					tmpHarness.view.setImage('https://host/picture.png');
					simulateLoad(tmpHarness.view, 10, 10);
					Expect(tmpHarness.view._downloadElement.style.display).to.equal('inline-flex');
					Expect(tmpHarness.view._downloadElement.getAttribute('href')).to.equal('https://host/picture.png');
					return fDone();
				});
			}
		);

		suite
		(
			'Zoom + pan',
			() =>
			{
				test('zoomIn switches to the scrolling presentation and labels the zoom', (fDone) =>
				{
					const tmpHarness = buildView();
					tmpHarness.view.setImage('https://host/picture.png');
					simulateLoad(tmpHarness.view, 400, 400);
					tmpHarness.view.zoomIn();   // 1 -> 1.5
					Expect(tmpHarness.view.getState().Zoom).to.equal(1.5);
					Expect(tmpHarness.view._stageElement.classList.contains('psi-scroll')).to.equal(true);
					Expect(tmpHarness.view._stageElement.classList.contains('psi-fit')).to.equal(false);
					Expect(tmpHarness.view._zoomLabelElement.textContent).to.equal('150%');
					return fDone();
				});
				test('sizes the zoomed image in pixels from the fit size when the box is measurable', (fDone) =>
				{
					const tmpHarness = buildView();
					tmpHarness.view.setImage('https://host/picture.png');
					simulateLoad(tmpHarness.view, 1000, 500);
					stubStageBox(tmpHarness.view, 500, 500);   // fit scale = min(0.5, 1.0, 1) = 0.5 -> fit 500x250
					tmpHarness.view.zoomIn();                  // zoom 1.5 -> 750x375
					Expect(tmpHarness.view._imageElement.style.width).to.equal('750px');
					Expect(tmpHarness.view._imageElement.style.height).to.equal('375px');
					return fDone();
				});
				test('falls back to a percentage width when the box is not measurable', (fDone) =>
				{
					const tmpHarness = buildView();
					tmpHarness.view.setImage('https://host/picture.png');
					simulateLoad(tmpHarness.view, 0, 0);   // headless: no natural size -> no fit size
					tmpHarness.view.zoomIn();              // 1 -> 1.5
					Expect(tmpHarness.view._imageElement.style.width).to.equal('150%');
					return fDone();
				});
				test('zoomOut returns to fit at the floor', (fDone) =>
				{
					const tmpHarness = buildView();
					tmpHarness.view.setImage('https://host/picture.png');
					simulateLoad(tmpHarness.view, 400, 400);
					tmpHarness.view.zoomIn();
					tmpHarness.view.zoomOut();   // 1.5 -> 1 (fit)
					Expect(tmpHarness.view.getState().Zoom).to.equal(1);
					Expect(tmpHarness.view.getState().Fit).to.equal(true);
					Expect(tmpHarness.view._stageElement.classList.contains('psi-fit')).to.equal(true);
					Expect(tmpHarness.view._zoomLabelElement.textContent).to.equal('Fit');
					return fDone();
				});
				test('zoom is clamped to MaxZoom', (fDone) =>
				{
					const tmpHarness = buildView({ MaxZoom: 2, ZoomStep: 0.5 });
					tmpHarness.view.setImage('https://host/picture.png');
					simulateLoad(tmpHarness.view, 400, 400);
					tmpHarness.view.zoomIn(); // 1.5
					tmpHarness.view.zoomIn(); // 2
					tmpHarness.view.zoomIn(); // clamp at 2
					Expect(tmpHarness.view.getState().Zoom).to.equal(2);
					return fDone();
				});
				test('toggleZoom flips between fit and zoomed', (fDone) =>
				{
					const tmpHarness = buildView();
					tmpHarness.view.setImage('https://host/picture.png');
					simulateLoad(tmpHarness.view, 400, 400);
					tmpHarness.view.toggleZoom();   // fit -> 1 + 0.5*2 = 2
					Expect(tmpHarness.view.getState().Zoom).to.equal(2);
					tmpHarness.view.toggleZoom();   // back to fit
					Expect(tmpHarness.view.getState().Zoom).to.equal(1);
					return fDone();
				});
				test('zoom controls are inert until the image has loaded', (fDone) =>
				{
					const tmpHarness = buildView();
					tmpHarness.view.setImage('https://host/picture.png');   // not yet loaded
					tmpHarness.view.zoomIn();
					Expect(tmpHarness.view.getState().Zoom).to.equal(1);
					return fDone();
				});
			}
		);

		suite
		(
			'Fullscreen (fill the viewport)',
			() =>
			{
				test('renders the fullscreen button by default', (fDone) =>
				{
					const tmpHarness = buildView();
					Expect(document.getElementById(tmpHarness.viewHash + '-FullscreenBtn')).to.not.equal(null);
					return fDone();
				});
				test('omits the fullscreen button when ShowFullscreen is false', (fDone) =>
				{
					const tmpHarness = buildView({ ShowFullscreen: false });
					Expect(document.getElementById(tmpHarness.viewHash + '-FullscreenBtn')).to.equal(null);
					// The rest of the toolbar is still present.
					Expect(document.getElementById(tmpHarness.viewHash + '-FitBtn')).to.not.equal(null);
					return fDone();
				});
				test('toggleFullscreen adds then removes the psi-fullscreen class and tracks state', (fDone) =>
				{
					const tmpHarness = buildView();
					const tmpRoot = document.getElementById(tmpHarness.viewHash + '-Root');
					Expect(tmpHarness.view.getState().Fullscreen).to.equal(false);

					tmpHarness.view.toggleFullscreen();
					Expect(tmpHarness.view.getState().Fullscreen).to.equal(true);
					Expect(tmpHarness.view.isFullscreen()).to.equal(true);
					Expect(tmpRoot.classList.contains('psi-fullscreen')).to.equal(true);

					tmpHarness.view.toggleFullscreen();
					Expect(tmpHarness.view.getState().Fullscreen).to.equal(false);
					Expect(tmpRoot.classList.contains('psi-fullscreen')).to.equal(false);
					return fDone();
				});
				test('enterFullscreen and exitFullscreen are idempotent', (fDone) =>
				{
					const tmpHarness = buildView();
					const tmpRoot = document.getElementById(tmpHarness.viewHash + '-Root');
					tmpHarness.view.enterFullscreen();
					tmpHarness.view.enterFullscreen();   // no-op
					Expect(tmpHarness.view.getState().Fullscreen).to.equal(true);
					Expect(tmpRoot.classList.contains('psi-fullscreen')).to.equal(true);
					tmpHarness.view.exitFullscreen();
					tmpHarness.view.exitFullscreen();    // no-op
					Expect(tmpHarness.view.getState().Fullscreen).to.equal(false);
					return fDone();
				});
				test('clicking the fullscreen button toggles it', (fDone) =>
				{
					const tmpHarness = buildView();
					const tmpButton = document.getElementById(tmpHarness.viewHash + '-FullscreenBtn');
					tmpButton.onclick();
					Expect(tmpHarness.view.getState().Fullscreen).to.equal(true);
					tmpButton.onclick();
					Expect(tmpHarness.view.getState().Fullscreen).to.equal(false);
					return fDone();
				});
				test('the Escape key exits fullscreen (and is a no-op otherwise)', (fDone) =>
				{
					const tmpHarness = buildView();
					// Escape while not fullscreen does nothing.
					document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
					Expect(tmpHarness.view.getState().Fullscreen).to.equal(false);

					tmpHarness.view.enterFullscreen();
					Expect(tmpHarness.view.getState().Fullscreen).to.equal(true);
					document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
					Expect(tmpHarness.view.getState().Fullscreen).to.equal(false);
					return fDone();
				});
				test('destroy detaches the Escape handler (a later Escape does not throw)', (fDone) =>
				{
					const tmpHarness = buildView();
					tmpHarness.view.enterFullscreen();
					tmpHarness.view.destroy();
					Expect(tmpHarness.view._keydownHandler).to.equal(null);
					// A stray Escape after teardown must not re-enter the destroyed view.
					document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
					Expect(tmpHarness.view.getState().Fullscreen).to.equal(false);
					return fDone();
				});
			}
		);

		suite
		(
			'Error handling',
			() =>
			{
				test('a load error paints the error state', (fDone) =>
				{
					const tmpHarness = buildView();
					tmpHarness.view.setImage('https://host/missing.png');
					tmpHarness.view._imageElement.onerror();
					Expect(tmpHarness.view.getState().Error).to.equal(true);
					const tmpStage = document.getElementById(tmpHarness.viewHash + '-Stage');
					Expect(tmpStage.querySelector('.psi-error')).to.not.equal(null);
					return fDone();
				});
				test('setImage after an error rebuilds a fresh <img> and recovers', (fDone) =>
				{
					const tmpHarness = buildView();
					tmpHarness.view.setImage('https://host/missing.png');
					tmpHarness.view._imageElement.onerror();
					Expect(tmpHarness.view.getState().Error).to.equal(true);

					tmpHarness.view.setImage('https://host/good.png');
					Expect(tmpHarness.view._imageElement).to.not.equal(null);
					Expect(tmpHarness.view._imageElement.getAttribute('src')).to.equal('https://host/good.png');
					simulateLoad(tmpHarness.view, 100, 100);
					Expect(tmpHarness.view.getState().Error).to.equal(false);
					Expect(tmpHarness.view.getState().Loaded).to.equal(true);
					return fDone();
				});
			}
		);

		suite
		(
			'Descriptor input + lifecycle',
			() =>
			{
				test('setImage accepts a descriptor object (URL, AltText, Name)', (fDone) =>
				{
					const tmpHarness = buildView();
					tmpHarness.view.setImage({ URL: 'https://host/cat.png', AltText: 'A cat', Name: 'cat.png' });
					Expect(tmpHarness.view._imageElement.getAttribute('src')).to.equal('https://host/cat.png');
					Expect(tmpHarness.view._imageElement.getAttribute('alt')).to.equal('A cat');
					simulateLoad(tmpHarness.view, 10, 10);
					Expect(tmpHarness.view._downloadElement.getAttribute('href')).to.equal('https://host/cat.png');
					return fDone();
				});
				test('destroy clears the viewer and detaches handlers', (fDone) =>
				{
					const tmpHarness = buildView();
					tmpHarness.view.setImage('https://host/picture.png');
					tmpHarness.view.destroy();
					Expect(tmpHarness.view._imageElement).to.equal(null);
					Expect(document.getElementById(tmpHarness.viewHash + '-Stage')).to.equal(null);
					return fDone();
				});
				test('two instances on one page do not collide (distinct ids)', (fDone) =>
				{
					const tmpA = buildView();
					const tmpB = buildView();
					Expect(tmpA.viewHash).to.not.equal(tmpB.viewHash);
					tmpA.view.setImage('https://host/a.png');
					tmpB.view.setImage('https://host/b.png');
					Expect(tmpA.view._imageElement.getAttribute('src')).to.equal('https://host/a.png');
					Expect(tmpB.view._imageElement.getAttribute('src')).to.equal('https://host/b.png');
					// Each has its own stage node.
					Expect(document.getElementById(tmpA.viewHash + '-Stage'))
						.to.not.equal(document.getElementById(tmpB.viewHash + '-Stage'));
					return fDone();
				});
			}
		);
	}
);
