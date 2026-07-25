import { parseCsv } from '$lib/csv';
import { editor } from './editor.svelte';
import { extractVars, resolveValues } from './vars';

/**
 * The loaded CSV. Deliberately not persisted — data files can be large and
 * change between sessions. Variables bind to column names directly, so
 * re-importing next week's CSV with the same headers just works.
 */
class DataState {
	fileName = $state<string | null>(null);
	columns = $state<string[]>([]);
	rows = $state<Record<string, string>[]>([]);
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

	/** What the canvas should render right now: preview row values, or nothing. */
	get previewValues(): Record<string, string | undefined> {
		return this.preview ? resolveValues(this.previewRow, editor.template.formats) : {};
	}

	/** Columns that at least one element references. */
	get usedColumns(): Set<string> {
		return new Set(extractVars(editor.template).filter((v) => this.columns.includes(v)));
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
