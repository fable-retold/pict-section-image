const libPictApplication = require('pict-application');

// The standalone image section — used here directly (no pict-section-fileview), with its own Fit / zoom / download
// toolbar. This is the same class fileview mounts as its ordinary-image lens; on its own it is a complete viewer.
const libPictSectionImage = require('../../source/Pict-Section-Image.js');

// Each viewer: a distinct ViewIdentifier + the div it builds into + the image it opens. The default configuration
// points every element id at #ImageViewer-Container-Div, so each instance overrides the renderable/destination/
// target to its own div — that is what lets four viewers coexist on one page (ids derive from the instance).
function buildViewerConfig(pIdentifier, pDestination, pImageURL, pAltText)
{
	return Object.assign({}, libPictSectionImage.default_configuration,
	{
		"ViewIdentifier": pIdentifier,
		"RenderOnLoad": false,
		"DefaultRenderable": pIdentifier + '-Wrap',
		"DefaultDestinationAddress": pDestination,
		"TargetElementAddress": pDestination,
		"Templates": [ { "Hash": pIdentifier + '-Container', "Template": '<!-- image viewer host -->' } ],
		"Renderables": [ { "RenderableHash": pIdentifier + '-Wrap', "TemplateHash": pIdentifier + '-Container', "DestinationAddress": pDestination, "RenderMethod": 'replace' } ],
		"ImageURL": pImageURL,
		"AltText": pAltText,
		"DownloadName": pImageURL.split('/').pop(),
		"ShowToolbar": true
	});
}

const _Viewers =
[
	{ Identifier: 'ImgLandscape', Destination: '#Img-Landscape', URL: './landscape.jpg', Alt: 'A sample landscape photograph' },
	{ Identifier: 'ImgPanorama',  Destination: '#Img-Panorama',  URL: './panorama.jpg',  Alt: 'A wide panorama — zoom in and pan' },
	{ Identifier: 'ImgPortrait',  Destination: '#Img-Portrait',  URL: './portrait.png',  Alt: 'A tall portrait PNG' },
	{ Identifier: 'ImgVector',    Destination: '#Img-Vector',    URL: './diagram.svg',   Alt: 'A vector diagram (SVG)' }
];

class ImageViewerExampleApplication extends libPictApplication
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		for (let i = 0; i < _Viewers.length; i++)
		{
			const tmpViewer = _Viewers[i];
			this.pict.addView(tmpViewer.Identifier,
				buildViewerConfig(tmpViewer.Identifier, tmpViewer.Destination, tmpViewer.URL, tmpViewer.Alt),
				libPictSectionImage);
		}
	}

	onAfterInitialize()
	{
		super.onAfterInitialize();

		for (let i = 0; i < _Viewers.length; i++)
		{
			const tmpView = this.pict.views[_Viewers[i].Identifier];
			if (tmpView) { tmpView.render(); }
		}
	}
}

module.exports = ImageViewerExampleApplication;

module.exports.default_configuration =
{
	"Name": "Image Viewer Example",
	"Hash": "ImageViewerExample",
	"pict_configuration":
	{
		"Product": "ImageViewer-Example"
	}
};
