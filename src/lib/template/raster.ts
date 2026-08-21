import { fitsPrinter, MODELS } from '$lib/printer/models';
import type { Template } from './schema';
import { buildNode } from './nodes';

/**
 * Render a template with a CSV row's values at exactly width×height device
 * pixels, through the same buildNode the editor uses. Headless — batch
 * printing works without the designer open.
 *
 * Throws if any barcode's substituted data is invalid for its symbology.
 */
export async function renderTemplateToCanvas(
	template: Template,
	values: Record<string, string | undefined>
): Promise<HTMLCanvasElement> {
	// Fonts must be resolved before rasterizing or the first label of a batch
	// prints in a fallback font.
	await document.fonts.ready;
	const K = (await import('konva')).default;
	const stage = new K.Stage({
		container: document.createElement('div'),
		width: template.width,
		height: template.height
	});
	try {
		// smoothing off to match the editor layer exactly — both draw the same
		// dot-resolution node caches, so preview and paper are pixel-identical
		const layer = new K.Layer({ listening: false, imageSmoothingEnabled: false });
		stage.add(layer);
		// always white here, whatever stock colour the editor previews: the
		// printer burns black onto the stock, and thresholding a coloured
		// background would print the whole label solid black
		layer.add(
			new K.Rect({ x: 0, y: 0, width: template.width, height: template.height, fill: '#fff' })
		);
		// elements are independent; render them concurrently (order preserved)
		const nodes = await Promise.all(template.elements.map((el) => buildNode(K, el, values)));
		for (const node of nodes) layer.add(node);
		layer.draw();
		// Crop explicitly to the label. Without x/y/width/height, Konva exports
		// the CONTENT bounding box, so a single element hanging over the edge
		// (which the editor allows) would silently widen the raster and desync
		// the printer's row reader. pixelRatio 1 pins 1 unit = 1 printer dot.
		return stage.toCanvas({
			x: 0,
			y: 0,
			width: template.width,
			height: template.height,
			pixelRatio: 1
		});
	} finally {
		stage.destroy();
	}
}

/**
 * One label, rendered and checked: template + CSV row → a canvas at exactly
 * the label's dot size, ready for whichever driver is connected.
 *
 * Both wire formats are unforgiving about width in the same way — a row that
 * is not the size the printer was told to expect shifts everything after it
 * and can hang the firmware — so the guard lives here, above the seam, and
 * runs whichever printer is selected.
 */
export async function buildPrintCanvas(
	template: Template,
	values: Record<string, string | undefined>
): Promise<HTMLCanvasElement> {
	const cv = await renderTemplateToCanvas(template, values);
	if (cv.width !== template.width || cv.height !== template.height) {
		throw new Error(
			`render is ${cv.width}×${cv.height}, expected ${template.width}×${template.height}`
		);
	}
	const model = MODELS[template.printer];
	const fit = fitsPrinter(cv, template.printDirection, model);
	if (!fit.fits) throw new Error(`this label is ${fit.reason}`);
	return cv;
}
