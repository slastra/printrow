import type { PrintDirection } from './models';

/**
 * Put `dots` rows of blank feed ahead of a raster, so the design starts that
 * far past wherever the printer begins the page.
 *
 * The raster is still in design orientation here — the protocol library
 * rotates it for the `left` direction later — so "ahead along the feed" is
 * the top of the image when the top edge feeds first, and the LEFT of the
 * image when the left edge does. Getting that wrong shifts the print
 * sideways instead of down.
 */
export function leadFeed(
	rows: Uint8Array[],
	dots: number,
	direction: PrintDirection
): Uint8Array[] {
	if (dots <= 0 || !rows.length) return rows;
	if (direction === 'top') {
		const width = rows[0].length;
		const blank = Array.from({ length: dots }, () => new Uint8Array(width));
		return [...blank, ...rows];
	}
	return rows.map((row) => {
		const out = new Uint8Array(dots + row.length);
		out.set(row, dots);
		return out;
	});
}
