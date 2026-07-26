import {
	blankTemplate,
	ElementSchema,
	TemplateSchema,
	DOTS_PER_MM,
	LABEL_W,
	LABEL_H,
	MIN_SIZE,
	MEDIA_MIN_MM,
	MEDIA_MAX_W_MM,
	MEDIA_MAX_H_MM,
	FORMAT_OPTIONS,
	DEFAULT_FORMAT,
	ColumnFormatSchema,
	type AnyElement,
	type ColumnFormat,
	type Template
} from './schema';
import {
	alignTargets,
	arrangeUnits,
	distributeTargets,
	selectionBounds,
	type AlignKind
} from './geometry';
import { ELEMENT_META, type ElementKind } from './elements';
import { loadImage } from './nodes';
import { clamp } from '$lib/utils';

const STORAGE_KEY = 'printrow:template:v1';
const HISTORY_LIMIT = 100;
const COALESCE_MS = 500;
const INTERN_PREFIX = '@interned:';

/**
 * The template model is the single source of truth; Konva is a view of it.
 * The LabelEditor component rebuilds nodes from `template.elements` and feeds
 * gesture results back through updateGeometry. Array order is draw order —
 * z-index operations are array reorders.
 *
 * Every mutation goes through commit(), which owns the history/autosave
 * bookkeeping — mutators never call pushHistory/scheduleSave by hand.
 */
class EditorState {
	template = $state<Template>(blankTemplate());
	selectedIds = $state<string[]>([]);
	/**
	 * Set by a canvas double-click. Two things answer it independently: the
	 * sidebar opens, and the Inspector focuses that element's primary field.
	 *
	 * Carries a nonce rather than being cleared by whoever handles it first.
	 * Clearing made the two racy — effects run in creation order, so the
	 * Inspector wiped the request before the sidebar watcher ever saw it, and
	 * the field got focus while still hidden behind a collapsed sidebar.
	 */
	editRequest = $state<{ id: string; nonce: number } | null>(null);
	private editNonce = 0;
	/** The label itself is selectable, like a bottom layer. */
	labelSelected = $state(false);

	private saveTimer: ReturnType<typeof setTimeout> | undefined;
	private past = $state<string[]>([]);
	private future = $state<string[]>([]);
	private lastPush = 0;
	private lastSavedJson: string | null = null;
	// Image dataUrls are interned out of history snapshots — they're immutable
	// per element, and 100 snapshots × embedded base64 photos would otherwise
	// retain hundreds of MB.
	private internedImages = new Map<string, string>();
	private internCounter = 0;

	get canUndo(): boolean {
		return this.past.length > 0;
	}

	get canRedo(): boolean {
		return this.future.length > 0;
	}

	get selectedElements(): AnyElement[] {
		return this.template.elements.filter((e) => this.selectedIds.includes(e.id));
	}

	/** The selected element when exactly one is — what the inspector edits. */
	get single(): AnyElement | null {
		return this.selectedIds.length === 1 ? (this.byId(this.selectedIds[0]) ?? null) : null;
	}

	/**
	 * How many independent objects are selected, counting each group as one.
	 * Arrange actions are gated on this rather than on the element count, so
	 * they offer only what they can actually do.
	 */
	get unitCount(): number {
		return arrangeUnits(this.selectedElements).length;
	}

	/** True when the whole selection is one intact group. */
	get selectionGrouped(): boolean {
		const els = this.selectedElements;
		return (
			els.length > 1 && els.every((e) => e.groupId !== undefined && e.groupId === els[0].groupId)
		);
	}

	byId(id: string): AnyElement | undefined {
		return this.template.elements.find((e) => e.id === id);
	}

	load() {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return;
			const parsed = TemplateSchema.safeParse(JSON.parse(raw));
			if (parsed.success) this.template = parsed.data;
		} catch {
			// unreadable autosave — start fresh rather than wedge the editor
		}
	}

	// --- history -------------------------------------------------------------

	/** pushHistory → mutate → scheduleSave, the only mutation path. */
	private commit(mutate: () => void) {
		this.pushHistory();
		mutate();
		this.scheduleSave();
	}

	/**
	 * Capture the pre-mutation state. Calls within 500 ms coalesce into one
	 * step, so a typing burst, arrow-key spam, or a multi-element drag undoes
	 * as a single unit.
	 */
	private pushHistory() {
		const now = Date.now();
		if (now - this.lastPush < COALESCE_MS && this.past.length) {
			this.lastPush = now;
			return;
		}
		this.lastPush = now;
		this.past.push(this.snapshot());
		if (this.past.length > HISTORY_LIMIT) this.past.shift();
		this.future = [];
	}

	private snapshot(): string {
		return JSON.stringify(this.template, (key, value) => {
			if (key === 'dataUrl' && typeof value === 'string' && !value.startsWith(INTERN_PREFIX)) {
				for (const [token, url] of this.internedImages) if (url === value) return token;
				const token = `${INTERN_PREFIX}${this.internCounter++}`;
				this.internedImages.set(token, value);
				return token;
			}
			return value;
		});
	}

	private restore(json: string) {
		const revived = JSON.parse(json, (key, value) =>
			key === 'dataUrl' && typeof value === 'string' && value.startsWith(INTERN_PREFIX)
				? (this.internedImages.get(value) ?? value)
				: value
		);
		const parsed = TemplateSchema.safeParse(revived);
		if (!parsed.success) return;
		this.template = parsed.data;
		this.selectedIds = this.selectedIds.filter((id) =>
			parsed.data.elements.some((e) => e.id === id)
		);
		this.lastPush = 0; // an undo boundary must never coalesce with what follows
		this.scheduleSave();
	}

	undo() {
		const snapshot = this.past.pop();
		if (snapshot === undefined) return;
		this.future.push(this.snapshot());
		this.restore(snapshot);
	}

	redo() {
		const snapshot = this.future.pop();
		if (snapshot === undefined) return;
		this.past.push(this.snapshot());
		this.restore(snapshot);
	}

	// --- selection -----------------------------------------------------------

	private expandGroup(id: string): string[] {
		const el = this.byId(id);
		if (!el?.groupId) return [id];
		return this.template.elements.filter((e) => e.groupId === el.groupId).map((e) => e.id);
	}

	/** Click selection. Clicking a group member selects the whole group. */
	select(id: string, opts: { toggle?: boolean } = {}) {
		this.labelSelected = false;
		const ids = this.expandGroup(id);
		const allIn = ids.every((i) => this.selectedIds.includes(i));
		if (opts.toggle) {
			this.selectedIds = allIn
				? this.selectedIds.filter((i) => !ids.includes(i))
				: [...new Set([...this.selectedIds, ...ids])];
		} else if (!allIn) {
			this.selectedIds = ids;
		}
		// plain click on an already-selected member keeps the selection so a
		// drag that follows moves the whole thing
	}

	/** Marquee / programmatic selection. */
	setSelection(ids: string[], opts: { expand?: boolean } = {}) {
		this.labelSelected = false;
		this.selectedIds = [
			...new Set((opts.expand ?? true) ? ids.flatMap((i) => this.expandGroup(i)) : ids)
		];
	}

	selectAll() {
		this.selectedIds = this.template.elements.map((e) => e.id);
	}

	clearSelection() {
		this.selectedIds = [];
		this.labelSelected = false;
	}

	/**
	 * Canvas double-click: select just this element and ask for its editable
	 * field. Deliberately not expanding the group — a double-click means "edit
	 * this one", where a single click means "move the whole group".
	 */
	requestEdit(id: string) {
		this.setSelection([id], { expand: false });
		this.editRequest = { id, nonce: ++this.editNonce };
	}

	// --- template ------------------------------------------------------------

	formatFor(column: string): ColumnFormat {
		return this.template.formats[column] ?? DEFAULT_FORMAT;
	}

	isFormatted(column: string): boolean {
		return this.template.formats[column] !== undefined;
	}

	/** Per-column display formatting. Merges over the column's current format. */
	setFormat(column: string, patch: Partial<ColumnFormat>) {
		const next = { ...(this.template.formats[column] ?? {}), ...patch };
		// Switching kind must drop options that kind doesn't expose, or an
		// invisible setting (say uppercase, chosen while it was a text column)
		// keeps applying with no control to turn it off.
		if (patch.kind !== undefined) {
			for (const key of Object.keys(next) as (keyof ColumnFormat)[]) {
				if (key !== 'kind' && !FORMAT_OPTIONS[patch.kind].has(key)) delete next[key];
			}
		}
		const merged = ColumnFormatSchema.safeParse(next);
		if (!merged.success) return;
		this.commit(() => {
			const { [column]: _prev, ...rest } = this.template.formats;
			// a format equal to the default is no format at all: keeping it would
			// leave the column flagged as customized forever
			const isDefault = JSON.stringify(merged.data) === JSON.stringify(DEFAULT_FORMAT);
			this.template.formats = isDefault ? rest : { ...rest, [column]: merged.data };
		});
	}

	resetFormat(column: string) {
		this.setFormat(column, DEFAULT_FORMAT);
	}

	/** Insert a {{column}} placeholder into the selected text or barcode element. */
	insertPlaceholder(column: string): boolean {
		const el = this.single;
		if (!el) return false;
		const token = `{{${column}}}`;
		if (el.type === 'text') this.updateById(el.id, { text: `${el.text}${token}` });
		else if (el.type === 'barcode') this.updateById(el.id, { data: `${el.data}${token}` });
		else return false;
		return true;
	}

	/** Change label stock. Elements keep their positions; re-clamp to the new bounds. */
	/** Stock colour is preview-only; the raster is always black on white. */
	setStockColor(hex: string) {
		this.commit(() => (this.template.stockColor = hex));
	}

	/** Die-cut corner rounding, 0–50% of the label. Preview only. */
	setStockRadius(pct: number) {
		this.commit(() => (this.template.stockRadius = clamp(Math.round(pct), 0, 50)));
	}

	selectLabel() {
		this.selectedIds = [];
		this.labelSelected = true;
	}

	setMedia(wMm: number, hMm: number) {
		// clamp here, not at the call site: an out-of-range size would fail
		// TemplateSchema on the next load and discard the whole template
		const w = clamp(Math.round(wMm), MEDIA_MIN_MM, MEDIA_MAX_W_MM);
		const h = clamp(Math.round(hMm), MEDIA_MIN_MM, MEDIA_MAX_H_MM);
		this.commit(() => {
			this.template.width = w * DOTS_PER_MM;
			this.template.height = h * DOTS_PER_MM;
			for (const el of this.template.elements) {
				el.x = this.clampX(el.x, el.w);
				el.y = this.clampY(el.y, el.h);
			}
		});
	}

	// --- elements ------------------------------------------------------------

	add(kind: ElementKind, extra: Record<string, unknown> = {}) {
		const el = ElementSchema.parse({
			id: crypto.randomUUID(),
			x: 24,
			y: 24,
			...ELEMENT_META[kind].defaults,
			...extra
		});
		this.commit(() => {
			this.template.elements.push(el);
		});
		this.selectedIds = [el.id];
	}

	async addImageFromFile(file: File) {
		const dataUrl = await new Promise<string>((resolve, reject) => {
			const r = new FileReader();
			r.onload = () => resolve(r.result as string);
			r.onerror = () => reject(new Error('could not read file'));
			r.readAsDataURL(file);
		});
		const img = await loadImage(dataUrl); // also warms the render cache
		// fit within the label at natural aspect
		const scale = Math.min(1, (LABEL_H * 0.66) / img.height, (LABEL_W * 0.66) / img.width);
		this.add('image', {
			dataUrl,
			w: Math.max(MIN_SIZE, Math.round(img.width * scale)),
			h: Math.max(MIN_SIZE, Math.round(img.height * scale))
		});
	}

	/** Inspector edits on the single selected element. */
	update(patch: Partial<AnyElement>) {
		if (this.single) this.updateById(this.single.id, patch);
	}

	/**
	 * The mutation funnel for element fields. Validates through the schema so
	 * out-of-range inspector input (font size 300, thickness 60) can never
	 * reach the autosave — an invalid saved template would be discarded
	 * wholesale on the next load.
	 */
	updateById(id: string, patch: Partial<AnyElement>) {
		const el = this.byId(id);
		if (!el) return;
		const merged = ElementSchema.safeParse({ ...el, ...patch });
		if (!merged.success) return;
		this.commit(() => Object.assign(el, merged.data));
	}

	/** Gesture results from Konva. Rounded to whole dots — 1-bit has no subpixels. */
	updateGeometry(id: string, geo: Partial<Pick<AnyElement, 'x' | 'y' | 'w' | 'h' | 'rotation'>>) {
		const el = this.byId(id);
		if (!el) return;
		const patch: Partial<AnyElement> = {};
		if (geo.w !== undefined) patch.w = Math.max(MIN_SIZE, Math.round(geo.w));
		if (geo.h !== undefined) patch.h = Math.max(MIN_SIZE, Math.round(geo.h));
		if (geo.rotation !== undefined) patch.rotation = ((Math.round(geo.rotation) % 360) + 360) % 360;
		// keep-on-label applies to every position mutation (drag, nudge, paste)
		const w = patch.w ?? el.w,
			h = patch.h ?? el.h;
		if (geo.x !== undefined) patch.x = this.clampX(Math.round(geo.x), w);
		if (geo.y !== undefined) patch.y = this.clampY(Math.round(geo.y), h);
		this.updateById(id, patch);
	}

	private clampX(x: number, w: number): number {
		return clamp(x, -w + MIN_SIZE, this.template.width - MIN_SIZE);
	}

	private clampY(y: number, h: number): number {
		return clamp(y, -h + MIN_SIZE, this.template.height - MIN_SIZE);
	}

	remove(ids = this.selectedIds) {
		if (!ids.length) return;
		this.commit(() => {
			this.template.elements = this.template.elements.filter((e) => !ids.includes(e.id));
			this.selectedIds = this.selectedIds.filter((id) => !ids.includes(id));
		});
	}

	duplicateSelection() {
		const els = this.selectedElements;
		if (!els.length) return;
		const gidMap = new Map<string, string>();
		const copies = els.map((el) => {
			const copy: AnyElement = { ...el, id: crypto.randomUUID(), x: el.x + 8, y: el.y + 8 };
			if (copy.groupId) {
				if (!gidMap.has(copy.groupId)) gidMap.set(copy.groupId, crypto.randomUUID());
				copy.groupId = gidMap.get(copy.groupId);
			}
			return copy;
		});
		this.commit(() => {
			this.template.elements.push(...copies);
		});
		this.selectedIds = copies.map((c) => c.id);
	}

	nudge(dx: number, dy: number) {
		const els = this.selectedElements;
		if (!els.length) return;
		this.commit(() => {
			for (const el of els) {
				el.x = this.clampX(el.x + dx, el.w);
				el.y = this.clampY(el.y + dy, el.h);
			}
		});
	}

	// --- arrange -------------------------------------------------------------

	/**
	 * A single unit aligns to the label; two or more align within the selection
	 * bounds. Counted in units, not elements, so selecting one whole group
	 * centres that group on the label rather than collapsing its members onto
	 * each other.
	 */
	align(kind: AlignKind) {
		const els = this.selectedElements;
		if (!els.length) return;
		const bounds =
			this.unitCount === 1
				? { x: 0, y: 0, w: this.template.width, h: this.template.height }
				: selectionBounds(els);
		this.applyMoves(alignTargets(kind, els, bounds));
	}

	distribute(axis: 'x' | 'y') {
		if (this.unitCount < 3) return;
		this.applyMoves(distributeTargets(axis, this.selectedElements));
	}

	private applyMoves(moves: { id: string; x: number; y: number }[]) {
		this.commit(() => {
			for (const m of moves) {
				const el = this.byId(m.id);
				if (el) {
					el.x = m.x;
					el.y = m.y;
				}
			}
		});
	}

	groupSelection() {
		if (this.selectedElements.length < 2) return;
		const gid = crypto.randomUUID();
		this.commit(() => {
			for (const el of this.selectedElements) el.groupId = gid;
		});
	}

	ungroupSelection() {
		this.commit(() => {
			for (const el of this.selectedElements) el.groupId = undefined;
		});
	}

	// --- z-order (array order = draw order) ----------------------------------

	private reorder(
		mutate: (arr: AnyElement[], sel: Set<string>) => AnyElement[],
		ids = this.selectedIds
	) {
		if (!ids.length) return;
		this.commit(() => {
			this.template.elements = mutate([...this.template.elements], new Set(ids));
		});
	}

	bringToFront(ids?: string[]) {
		this.reorder(
			(arr, sel) => [...arr.filter((e) => !sel.has(e.id)), ...arr.filter((e) => sel.has(e.id))],
			ids
		);
	}

	sendToBack(ids?: string[]) {
		this.reorder(
			(arr, sel) => [...arr.filter((e) => sel.has(e.id)), ...arr.filter((e) => !sel.has(e.id))],
			ids
		);
	}

	/** Layers-panel drag reorder: ids arrive frontmost-first (list order). */
	setOrder(idsFrontToBack: string[]) {
		const byId = new Map(this.template.elements.map((e) => [e.id, e]));
		const ordered = idsFrontToBack
			.map((id) => byId.get(id))
			.filter((e): e is AnyElement => Boolean(e))
			.reverse();
		// safety: anything the list didn't mention stays at the back
		const listed = new Set(idsFrontToBack);
		const missing = this.template.elements.filter((e) => !listed.has(e.id));
		this.commit(() => {
			this.template.elements = [...missing, ...ordered];
		});
	}

	raise(ids?: string[]) {
		this.reorder((arr, sel) => {
			for (let i = arr.length - 2; i >= 0; i--)
				if (sel.has(arr[i].id) && !sel.has(arr[i + 1].id))
					[arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
			return arr;
		}, ids);
	}

	lower(ids?: string[]) {
		this.reorder((arr, sel) => {
			for (let i = 1; i < arr.length; i++)
				if (sel.has(arr[i].id) && !sel.has(arr[i - 1].id))
					[arr[i], arr[i - 1]] = [arr[i - 1], arr[i]];
			return arr;
		}, ids);
	}

	// --- persistence ---------------------------------------------------------

	private scheduleSave() {
		clearTimeout(this.saveTimer);
		this.saveTimer = setTimeout(() => {
			const json = JSON.stringify(this.template);
			if (json !== this.lastSavedJson) {
				localStorage.setItem(STORAGE_KEY, json);
				this.lastSavedJson = json;
			}
		}, 400);
	}
}

export const editor = new EditorState();
