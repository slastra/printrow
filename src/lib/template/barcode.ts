import type { BarcodeElement } from './schema';

export type BarcodeSpec = Pick<BarcodeElement, 'bcid' | 'data'>;

let bwip: typeof import('bwip-js') | undefined;

/**
 * Render a barcode to a fresh canvas. Throws on data the symbology rejects
 * (e.g. a non-numeric EAN-13) — callers surface that instead of printing a
 * stale or blank code.
 *
 * Dynamically imported so bwip-js never loads during SSR.
 */
export async function barcodeCanvas(
	spec: BarcodeSpec,
	data = spec.data
): Promise<HTMLCanvasElement> {
	bwip ??= await import('bwip-js');
	const cv = document.createElement('canvas');
	// scale 1 = one module per canvas pixel; nodes.ts fits this to the placed
	// box at an integer dot multiple so bars stay crisp at any element size.
	bwip.toCanvas(cv, {
		bcid: spec.bcid,
		text: data || ' ',
		scale: 1
		// no backgroundcolor: bwip leaves the plate transparent, so the label's
		// stock colour shows through the quiet zone
	});
	return cv;
}

const TWO_D = new Set<string>(['qrcode', 'datamatrix']);

/** Where a scale-1 render lands in the element's box, in whole dots. */
export interface BarcodePlacement {
	x: number;
	y: number;
	w: number;
	h: number;
}

/**
 * Size a scale-1 render to the box at a whole-number scale, so every module is
 * an exact number of printer dots. Fractional module widths are what make
 * scaled barcodes both blurry on screen and marginal under a scanner. What
 * the scale leaves over becomes quiet zone, split evenly.
 *
 * 2D codes scale uniformly, since their modules must stay square. The bars of
 * a 1D code are uniform down each column, so stretching those to the box
 * height is exact. Never below scale 1: a box too small for the code
 * overhangs rather than dropping modules.
 */
export function barcodePlacement(
	base: { width: number; height: number },
	el: Pick<BarcodeElement, 'bcid' | 'w' | 'h'>
): BarcodePlacement {
	const sx = Math.max(1, Math.floor(el.w / base.width));
	if (TWO_D.has(el.bcid)) {
		const s = Math.max(1, Math.min(sx, Math.floor(el.h / base.height)));
		const w = base.width * s;
		const h = base.height * s;
		return { x: Math.floor((el.w - w) / 2), y: Math.floor((el.h - h) / 2), w, h };
	}
	const w = base.width * sx;
	return { x: Math.floor((el.w - w) / 2), y: 0, w, h: el.h };
}
