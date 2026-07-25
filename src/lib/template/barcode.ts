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
