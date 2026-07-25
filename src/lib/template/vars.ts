import { DEFAULT_FORMAT, type ColumnFormat, type Template } from './schema';

export { DEFAULT_FORMAT };

// {{sku}}, {{ product.name }}, {{lot-no}} — first char must be a word char so
// stray braces in label copy don't register as variables.
const VAR_RE = /\{\{\s*([A-Za-z0-9_][\w.-]*)\s*\}\}/g;

export function varsInString(s: string): string[] {
	return [
		...new Set(
			splitVars(s)
				.filter((p) => p.isVar)
				.map((p) => p.text)
		)
	];
}

/**
 * Every variable the template uses, in element order. Derived by scanning the
 * elements rather than declared, so it can never drift from what the template
 * actually renders. A variable IS a CSV column name — there is no mapping step.
 */
export function extractVars(template: Template): string[] {
	return varsInString(
		template.elements
			.map((el) => (el.type === 'text' ? el.text : el.type === 'barcode' ? el.data : ''))
			.join('\n')
	);
}

const titleCase = (s: string) =>
	s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

const MONTHS =
	'January February March April May June July August September October November December'.split(
		' '
	);

/** Numeric value of a CSV cell, tolerating thousands separators and currency symbols. */
function toNumber(raw: string): number | null {
	const cleaned = raw.replace(/[\s,$€£¥]/g, '');
	if (cleaned === '') return null;
	const n = Number(cleaned);
	return Number.isFinite(n) ? n : null;
}

/**
 * Parse the date shapes CSVs actually contain, as calendar dates in local time
 * (never UTC, or a YYYY-MM-DD value shifts a day for western timezones).
 */
export function parseDate(raw: string): Date | null {
	const s = raw.trim();
	let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(s);
	if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
	// US convention when the first part can't be a day-of-month is ambiguous;
	// CSVs from spreadsheets are overwhelmingly M/D/Y, so take that.
	m = /^(\d{1,2})[/](\d{1,2})[/](\d{4})$/.exec(s);
	if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
	m = /^(\d{1,2})[.](\d{1,2})[.](\d{4})$/.exec(s);
	if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
	const parsed = new Date(s);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(d: Date, pattern: ColumnFormat['datePattern']): string {
	const p2 = (n: number) => String(n).padStart(2, '0');
	const y = d.getFullYear(),
		mo = d.getMonth(),
		day = d.getDate();
	switch (pattern) {
		case 'iso':
			return `${y}-${p2(mo + 1)}-${p2(day)}`;
		case 'us':
			return `${p2(mo + 1)}/${p2(day)}/${y}`;
		case 'eu':
			return `${p2(day)}/${p2(mo + 1)}/${y}`;
		case 'medium':
			return `${MONTHS[mo].slice(0, 3)} ${day}, ${y}`;
		case 'long':
			return `${MONTHS[mo]} ${day}, ${y}`;
		case 'day-month':
			return `${day} ${MONTHS[mo].slice(0, 3)} ${y}`;
		case 'compact':
			return `${p2(day)}${MONTHS[mo].slice(0, 3)}${String(y).slice(2)}`;
	}
}

/**
 * Apply a column's display formatting. Values that don't fit the chosen kind
 * (text in a number column, an unparseable date) pass through untouched rather
 * than printing a confusing NaN.
 */
export function formatValue(raw: string | undefined, fmt: ColumnFormat = DEFAULT_FORMAT): string {
	if (raw === undefined) return '';
	let out = raw;

	if (fmt.kind === 'number') {
		const n = toNumber(out);
		if (n !== null)
			out = n.toLocaleString('en-US', {
				minimumFractionDigits: fmt.decimals ?? 0,
				maximumFractionDigits: fmt.decimals ?? 20,
				minimumIntegerDigits: fmt.padDigits,
				useGrouping: fmt.thousands
			});
	} else if (fmt.kind === 'currency') {
		const n = toNumber(out);
		if (n !== null)
			out = n
				.toLocaleString('en-US', {
					style: 'currency',
					currency: fmt.currency,
					currencyDisplay: fmt.currencyCode ? 'code' : 'symbol',
					minimumFractionDigits: fmt.decimals ?? undefined,
					maximumFractionDigits: fmt.decimals ?? undefined,
					useGrouping: fmt.thousands
				})
				// Intl separates a currency code with U+00A0; plain spaces keep
				// the canvas measurement and any downstream text handling simple
				.replace(/ /g, ' ');
	} else if (fmt.kind === 'date') {
		const d = parseDate(out);
		if (d) out = formatDate(d, fmt.datePattern);
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

/**
 * Split a string into literal and {{var}} runs so the UI can render variables
 * distinctly from surrounding copy.
 */
export function splitVars(s: string): { text: string; isVar: boolean }[] {
	const out: { text: string; isVar: boolean }[] = [];
	let last = 0;
	for (const m of s.matchAll(VAR_RE)) {
		if (m.index > last) out.push({ text: s.slice(last, m.index), isVar: false });
		out.push({ text: m[1], isVar: true });
		last = m.index + m[0].length;
	}
	if (last < s.length) out.push({ text: s.slice(last), isVar: false });
	return out;
}

/** Unresolved placeholders stay visible rather than vanishing into blank paper. */
export function interpolate(s: string, values: Record<string, string | undefined>): string {
	return s.replace(VAR_RE, (whole, name: string) => values[name] ?? whole);
}

/** Template variables with no matching column in the loaded CSV. */
export function unknownVars(template: Template, columns: string[]): string[] {
	return extractVars(template).filter((v) => !columns.includes(v));
}
