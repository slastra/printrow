import { ColumnFormatSchema, type ColumnFormat, type Template } from './schema';

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
 * actually renders. A variable IS a CSV column name — there is no mapping step.
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

export const DEFAULT_FORMAT: ColumnFormat = ColumnFormatSchema.parse({});

const titleCase = (s: string) =>
	s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

/** Apply a column's display formatting. Non-numeric text ignores number options. */
export function formatValue(raw: string | undefined, fmt: ColumnFormat = DEFAULT_FORMAT): string {
	if (raw === undefined) return '';
	let out = raw;

	const n = Number(out.replace(/,/g, ''));
	const numeric = out.trim() !== '' && Number.isFinite(n);
	if (numeric && (fmt.decimals !== null || fmt.thousands)) {
		out = n.toLocaleString('en-US', {
			minimumFractionDigits: fmt.decimals ?? 0,
			maximumFractionDigits: fmt.decimals ?? 20,
			useGrouping: fmt.thousands
		});
	}

	if (fmt.transform === 'upper') out = out.toUpperCase();
	else if (fmt.transform === 'lower') out = out.toLowerCase();
	else if (fmt.transform === 'title') out = titleCase(out);

	out = `${fmt.prefix}${out}${fmt.suffix}`;
	// truncate after affixes so a prefix can't push past the limit unnoticed
	if (fmt.maxChars > 0 && out.length > fmt.maxChars) out = out.slice(0, fmt.maxChars - 1) + '…';
	return out;
}

/** A CSV row resolved to formatted values, keyed by column name. */
export function resolveValues(
	row: Record<string, string> | undefined,
	formats: Record<string, ColumnFormat> = {}
): Record<string, string | undefined> {
	if (!row) return {};
	return Object.fromEntries(
		Object.entries(row).map(([col, raw]) => [col, formatValue(raw, formats[col] ?? DEFAULT_FORMAT)])
	);
}

/** Unresolved placeholders stay visible rather than vanishing into blank paper. */
export function interpolate(s: string, values: Record<string, string | undefined>): string {
	return s.replace(VAR_RE, (whole, name: string) => values[name] ?? whole);
}

/** Template variables with no matching column in the loaded CSV. */
export function unknownVars(template: Template, columns: string[]): string[] {
	return extractVars(template).filter((v) => !columns.includes(v));
}
