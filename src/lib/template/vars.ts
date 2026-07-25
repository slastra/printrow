import type { Template } from './schema';

// {{sku}}, {{ product.name }}, {{lot-no}} — first char must be a word char so
// stray braces in label copy don't register as variables.
const VAR_RE = /\{\{\s*([A-Za-z0-9_][\w.-]*)\s*\}\}/g;

export function varsInString(s: string): string[] {
	const out: string[] = [];
	for (const m of s.matchAll(VAR_RE)) if (!out.includes(m[1])) out.push(m[1]);
	return out;
}

/**
 * Every variable the template uses, in element order. Derived by scanning the
 * elements rather than declared, so it can never drift from what the template
 * actually renders.
 */
export function extractVars(template: Template): string[] {
	const out: string[] = [];
	const add = (s: string) => {
		for (const v of varsInString(s)) if (!out.includes(v)) out.push(v);
	};
	for (const el of template.elements) {
		if (el.type === 'text') add(el.text);
		else if (el.type === 'barcode') add(el.data);
	}
	return out;
}

/** Unresolved placeholders stay visible rather than vanishing into blank paper. */
export function interpolate(s: string, values: Record<string, string | undefined>): string {
	return s.replace(VAR_RE, (whole, name: string) => values[name] ?? whole);
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Match template vars to CSV columns by normalized name ("Lot No" ↔ {{lot_no}}).
 * Unmatched vars are simply absent — the mapping UI surfaces them for a manual
 * pick.
 */
export function autoMap(vars: string[], columns: string[]): Record<string, string> {
	const byNorm = new Map(columns.map((c) => [normalize(c), c]));
	const out: Record<string, string> = {};
	for (const v of vars) {
		const hit = byNorm.get(normalize(v));
		if (hit !== undefined) out[v] = hit;
	}
	return out;
}

/** Resolve a CSV row into {var: value} through the template's mapping. */
export function rowValues(
	mapping: Record<string, string>,
	row: Record<string, string>
): Record<string, string | undefined> {
	return Object.fromEntries(Object.entries(mapping).map(([v, col]) => [v, row[col]]));
}

/** Vars with no usable mapping — unmapped, or mapped to a column the CSV no longer has. */
export function unmappedVars(template: Template, columns: string[]): string[] {
	return extractVars(template).filter(
		(v) => !template.mapping[v] || !columns.includes(template.mapping[v])
	);
}
