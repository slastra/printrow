import { parseCsv } from '$lib/csv';
import { editor } from './editor.svelte';
import { extractVars, formatValue } from './vars';

/** How a {{variable}} relates to the loaded CSV. */
export type VarStatus = 'detected' | 'unknown' | 'idle';

/**
 * The loaded CSV. Deliberately not persisted — data files can be large and
 * change between sessions. Variables bind to column names directly, so
 * re-importing next week's CSV with the same headers just works.
 */
class DataState {
	fileName = $state<string | null>(null);
	columns = $state<string[]>([]);
	// raw: rows are replaced wholesale, never mutated, so proxying every cell
	// would retain a signal per cell for thousands of rows
	rows = $state.raw<Record<string, string>[]>([]);
	previewIndex = $state(0);
	// When on, the editor canvas shows the preview row's values instead of
	// {{placeholders}}.
	preview = $state(true);

	get loaded(): boolean {
		return this.rows.length > 0;
	}

	get previewRow(): Record<string, string> | undefined {
		return this.rows[this.previewIndex];
	}

	/**
	 * Format a row through the template's column formats. Only the columns the
	 * template references are formatted — a 30-column CSV printing 500 labels
	 * would otherwise run thousands of Intl formats nobody reads.
	 */
	valuesFor(row: Record<string, string> | undefined): Record<string, string | undefined> {
		if (!row) return {};
		const out: Record<string, string> = {};
		for (const v of this.templateVars) {
			if (v in row) out[v] = formatValue(row[v], editor.formatFor(v));
		}
		return out;
	}

	/** What the canvas should render right now: preview row values, or nothing. */
	get previewValues(): Record<string, string | undefined> {
		return this.preview ? this.valuesFor(this.previewRow) : {};
	}

	/** Every {{variable}} the template uses, scanned once per template change. */
	readonly templateVars = $derived(extractVars(editor.template));

	/** Columns that at least one element references. */
	get usedColumns(): Set<string> {
		return new Set(this.templateVars.filter((v) => this.columns.includes(v)));
	}

	/**
	 * The one definition of what a {{variable}} means right now, so every
	 * surface (layers chips, data rows, print warnings) agrees:
	 * detected = a column exists, unknown = the CSV lacks it, idle = no CSV.
	 */
	varStatus(name: string): VarStatus {
		if (!this.loaded) return 'idle';
		return this.columns.includes(name) ? 'detected' : 'unknown';
	}

	/** Template variables with no matching column. Empty when no CSV is loaded. */
	get unknownVars(): string[] {
		return this.loaded ? this.templateVars.filter((v) => !this.columns.includes(v)) : [];
	}

	async loadFile(file: File) {
		const { columns, rows } = parseCsv(await file.text());
		if (!rows.length) throw new Error('CSV has a header but no data rows');
		this.fileName = file.name;
		this.columns = columns;
		this.rows = rows;
		this.previewIndex = 0;
	}

	clear() {
		this.fileName = null;
		this.columns = [];
		this.rows = [];
		this.previewIndex = 0;
	}

	step(delta: number) {
		if (!this.loaded) return;
		this.previewIndex = (this.previewIndex + delta + this.rows.length) % this.rows.length;
	}
}

export const data = new DataState();
