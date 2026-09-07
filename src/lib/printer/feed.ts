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

/**
 * Drop whatever of a raster overhangs the head, evenly from both edges, so a
 * design as wide as the stock prints at its drawn size minus the bleed.
 *
 * Like `leadFeed`, this sees the raster in design orientation: it is the
 * WIDTH that crosses the head when the top edge feeds first, and the HEIGHT
 * when the left edge does.
 */
export function trimAcross(
	rows: Uint8Array[],
	maxDots: number,
	direction: PrintDirection
): Uint8Array[] {
	if (!rows.length) return rows;
	if (direction === 'top') {
		const width = rows[0].length;
		if (width <= maxDots) return rows;
		const from = Math.floor((width - maxDots) / 2);
		return rows.map((row) => row.subarray(from, from + maxDots));
	}
	if (rows.length <= maxDots) return rows;
	const from = Math.floor((rows.length - maxDots) / 2);
	return rows.slice(from, from + maxDots);
}
