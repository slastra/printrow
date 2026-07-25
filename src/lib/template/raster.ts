import { buildStream, WIDTH, type RasterRow } from '$lib/printer/protocol';
import { DOTS_PER_MM, type Template } from './schema';
import { buildNode, lumaOverWhite, THRESHOLD } from './nodes';

/**
 * Threshold a rendered canvas to the printer's 1-bit rows, using the same
 * luma formula as every preview conversion.
 */
export function canvasToRows(cv: HTMLCanvasElement, threshold = THRESHOLD): RasterRow[] {
	const ctx = cv.getContext('2d', { willReadFrequently: true });
	if (!ctx) throw new Error('canvas has no 2d context');
	const { data } = ctx.getImageData(0, 0, cv.width, cv.height);
	const rows: RasterRow[] = [];
	for (let y = 0; y < cv.height; y++) {
		const row = new Uint8Array(cv.width);
		for (let x = 0; x < cv.width; x++) {
			row[x] = lumaOverWhite(data, (y * cv.width + x) * 4) < threshold ? 1 : 0;
		}
		rows.push(row);
	}
	return rows;
}

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

/** The full pipeline: template + CSV row → framed byte stream for the printer. */
export async function buildPrintStream(
	template: Template,
	values: Record<string, string | undefined>
): Promise<Uint8Array> {
	const cv = await renderTemplateToCanvas(template, values);
	// The wire format is unforgiving: rows must be exactly the media width in
	// dots, or the printer misreads the next row marker and can hang. Fail
	// loudly here rather than emit a stream that wedges the hardware.
	if (cv.width !== template.width || cv.height !== template.height) {
		throw new Error(
			`render is ${cv.width}×${cv.height}, expected ${template.width}×${template.height}`
		);
	}
	if (cv.width > WIDTH) throw new Error(`template width ${cv.width} exceeds print head ${WIDTH}`);
	return buildStream(canvasToRows(cv), Math.round(cv.width / DOTS_PER_MM));
}
