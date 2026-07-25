export interface IconEntry {
	/** kebab-case lucide id, e.g. "triangle-alert" */
	name: string;
	tags: string[];
	svg: string;
}

const pascal = (kebab: string) =>
	kebab
		.split('-')
		.map((p) => p.charAt(0).toUpperCase() + p.slice(1))
		.join('');

let indexPromise: Promise<IconEntry[]> | undefined;

/**
 * The whole lucide set, loaded once on first use. Dynamic so the ~2000 SVG
 * strings land in their own chunk rather than the initial bundle — nothing
 * pays for them until the picker opens.
 */
export function loadIcons(): Promise<IconEntry[]> {
	indexPromise ??= (async () => {
		const [svgs, tags] = await Promise.all([
			import('lucide-static'),
			import('lucide-static/tags.json')
		]);
		const svgMap = svgs as unknown as Record<string, string>;
		const tagMap = (tags.default ?? tags) as unknown as Record<string, string[]>;
		return Object.keys(tagMap)
			.map((name) => ({ name, tags: tagMap[name] ?? [], svg: svgMap[pascal(name)] }))
			.filter((e): e is IconEntry => typeof e.svg === 'string');
	})();
	return indexPromise;
}

/**
 * Rank icons for a query: exact name, then prefix, then substring, then a tag
 * hit. Tags are what make "warning" find triangle-alert, which plain name
 * matching never would. Results are capped so the list never renders 2000 nodes.
 */
export function searchIcons(index: IconEntry[], query: string, limit = 60): IconEntry[] {
	const q = query.trim().toLowerCase();
	if (!q) return index.slice(0, limit);
	const scored: { entry: IconEntry; score: number }[] = [];
	for (const entry of index) {
		let score = 0;
		if (entry.name === q) score = 5;
		else if (entry.name.startsWith(q)) score = 4;
		// an exact keyword beats a name substring: searching "warning" should
		// surface triangle-alert before battery-warning
		else if (entry.tags.includes(q)) score = 3;
		else if (entry.name.includes(q)) score = 2;
		else if (entry.tags.some((t) => t.includes(q))) score = 1;
		if (score) scored.push({ entry, score });
	}
	return scored
		.sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
		.slice(0, limit)
		.map((s) => s.entry);
}

/**
 * Resize a lucide SVG and set its stroke weight. Stroke must be expressed in
 * the 24-unit viewBox, so a fixed CSS width would render hairline-thin once
 * the icon is placed at label scale.
 */
export function iconSvg(raw: string, strokeWidth: number, px: number): string {
	return raw
		.replace(/width="[^"]*"/, `width="${px}"`)
		.replace(/height="[^"]*"/, `height="${px}"`)
		.replace(/stroke-width="[^"]*"/, `stroke-width="${strokeWidth}"`)
		.replace(/stroke="[^"]*"/, 'stroke="#000000"');
}

/** SVG string → data URL, for the same image path everything else uses. */
export function svgDataUrl(svg: string): string {
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
