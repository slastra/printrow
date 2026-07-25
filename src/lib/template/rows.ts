/**
 * Row-range parsing for printing a subset of the CSV, in the notation every
 * print dialog already uses: "1-5, 8, 12-20".
 *
 * Input is 1-based because that is what the data panel shows; output is
 * 0-based indices into `data.rows`. Results are sorted and deduplicated, so
 * "3, 1-2, 3" prints rows 1, 2, 3 once each in document order.
 *
 * Pure and DOM-free so the parsing rules can be tested directly.
 */

export interface RowSelection {
	/** Zero-based, sorted, unique. Empty when the spec is blank or invalid. */
	indices: number[];
	/** Human-readable reason the spec was rejected, or null. */
	error: string | null;
}

const RANGE = /^(\d*)\s*-\s*(\d*)$/;

export function parseRowSpec(spec: string, total: number): RowSelection {
	const trimmed = spec.trim();
	if (!trimmed) return { indices: [], error: null };
	if (total < 1) return { indices: [], error: 'No rows loaded' };

	const fail = (error: string): RowSelection => ({ indices: [], error });
	const outside = (part: string) => fail(`${part} is outside 1-${total}`);
	const seen = new Set<number>();

	for (const raw of trimmed.split(',')) {
		const part = raw.trim();
		if (!part) continue;

		const range = RANGE.exec(part);
		if (range) {
			const [, lo, hi] = range;
			// a bare "-" says nothing; "5-" means 5 to the end and "-5" means 1 to 5
			if (!lo && !hi) return fail(`"${part}" is not a row or range`);
			const from = lo ? Number(lo) : 1;
			const to = hi ? Number(hi) : total;
			// accept a reversed range rather than rejecting a clear intent
			const start = Math.min(from, to),
				end = Math.max(from, to);
			if (start < 1 || end > total) return outside(part);
			for (let i = start; i <= end; i++) seen.add(i - 1);
			continue;
		}

		if (!/^\d+$/.test(part)) return fail(`"${part}" is not a row or range`);
		const n = Number(part);
		if (n < 1 || n > total) return outside(part);
		seen.add(n - 1);
	}

	return { indices: [...seen].sort((a, b) => a - b), error: null };
}

/** "1-5, 8" for a set of indices, collapsing runs back into ranges. */
export function describeRows(indices: number[]): string {
	if (!indices.length) return '';
	const parts: string[] = [];
	let start = indices[0],
		prev = indices[0];
	const flush = () => parts.push(start === prev ? `${start + 1}` : `${start + 1}-${prev + 1}`);
	for (const i of indices.slice(1)) {
		if (i === prev + 1) {
			prev = i;
			continue;
		}
		flush();
		start = prev = i;
	}
	flush();
	return parts.join(', ');
}
