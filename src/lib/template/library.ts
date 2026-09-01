import { TemplateSchema, type Template } from './schema';

/**
 * The saved-template library.
 *
 * IndexedDB rather than localStorage, for one reason that decides it: images
 * are embedded in a template as base64 data URLs, so a handful of designs with
 * photos in them runs past localStorage's ~5 MB ceiling. A quota failure there
 * is silent from the user's side — the save simply stops happening — which is
 * the worst way for a library to break.
 *
 * Everything here is a thin promise wrapper over the raw API. No dependency:
 * the surface this needs is five calls wide, and a wrapper library would be
 * larger than the wrapper.
 */

const DB_NAME = 'printrow';
const DB_VERSION = 1;
const STORE = 'templates';
/** Which template is open. Small, synchronous, and read before the DB opens. */
const CURRENT_KEY = 'printrow:current:v1';
/** The pre-library autosave. Read once, migrated, then left alone. */
const LEGACY_KEY = 'printrow:template:v1';

/** A template as it sits in the library. */
export interface LibraryEntry {
	id: string;
	name: string;
	/** Epoch ms of the last write, so the list can sort by recency. */
	updatedAt: number;
}

interface StoredTemplate extends LibraryEntry {
	data: Template;
}

/** Whether this environment has the storage at all — false during SSR. */
export function hasLibrary(): boolean {
	return typeof indexedDB !== 'undefined';
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
	if (!hasLibrary()) return Promise.reject(new Error('no IndexedDB in this environment'));
	dbPromise ??= new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE)) {
				// keyPath rather than out-of-line keys: the id is already part of the
				// template, and two sources of truth for it would drift
				db.createObjectStore(STORE, { keyPath: 'id' });
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error ?? new Error('could not open the template library'));
		// Fires when another tab holds an old version open. Nothing to do but
		// fail: a half-upgraded store is worse than an unavailable one.
		req.onblocked = () => reject(new Error('another printrow tab is blocking a storage upgrade'));
	});
	return dbPromise;
}

/** Run one transaction and settle when it commits, not when the request does. */
async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
	const db = await openDb();
	return new Promise<T>((resolve, reject) => {
		const t = db.transaction(STORE, mode);
		const req = run(t.objectStore(STORE));
		let result: T;
		req.onsuccess = () => (result = req.result);
		// Resolving on `complete` rather than on the request means a write that
		// the transaction later rolls back is reported as the failure it is.
		t.oncomplete = () => resolve(result);
		t.onerror = () => reject(t.error ?? req.error ?? new Error('template storage failed'));
		t.onabort = () => reject(t.error ?? new Error('template storage was aborted'));
	});
}

/** Every saved template, most recently changed first. */
export async function listTemplates(): Promise<LibraryEntry[]> {
	const all = await tx<StoredTemplate[]>('readonly', (s) => s.getAll());
	return all
		.map(({ id, name, updatedAt }) => ({ id, name, updatedAt }))
		.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * One template by id, or null when it is not there.
 *
 * Parsed on the way out rather than trusted: a record written by an older
 * build is exactly the case the schema's defaults and migrations exist for,
 * and this is the boundary they have to run at.
 */
export async function getTemplate(id: string): Promise<Template | null> {
	const row = await tx<StoredTemplate | undefined>('readonly', (s) => s.get(id));
	if (!row) return null;
	const parsed = TemplateSchema.safeParse(row.data);
	return parsed.success ? parsed.data : null;
}

export async function putTemplate(template: Template): Promise<void> {
	const row: StoredTemplate = {
		id: template.id,
		name: template.name,
		updatedAt: Date.now(),
		data: template
	};
	await tx('readwrite', (s) => s.put(row));
}

export async function deleteTemplate(id: string): Promise<void> {
	await tx('readwrite', (s) => s.delete(id));
}

/** The id of the template that was open last, if any. */
export function readCurrentId(): string | null {
	try {
		return localStorage.getItem(CURRENT_KEY);
	} catch {
		return null;
	}
}

export function writeCurrentId(id: string): void {
	try {
		localStorage.setItem(CURRENT_KEY, id);
	} catch {
		// a browser with storage disabled still edits fine, it just forgets which
		// template was open — not worth failing a save over
	}
}

/**
 * Move the pre-library autosave into the library, once.
 *
 * Returns the migrated template so the caller can open it, or null when there
 * was nothing to migrate. The legacy key is deliberately NOT deleted: if this
 * build is rolled back, that key is the user's only copy of their work.
 */
export async function migrateLegacyAutosave(): Promise<Template | null> {
	let raw: string | null = null;
	try {
		raw = localStorage.getItem(LEGACY_KEY);
	} catch {
		return null;
	}
	if (!raw) return null;
	let parsed;
	try {
		parsed = TemplateSchema.safeParse(JSON.parse(raw));
	} catch {
		return null;
	}
	if (!parsed.success) return null;
	// Already migrated on an earlier boot: leave the library's copy alone, since
	// it is the one that has been edited since.
	if (await getTemplate(parsed.data.id)) return null;
	await putTemplate(parsed.data);
	return parsed.data;
}

// --- files -----------------------------------------------------------------

/** Extension for exported templates, distinctive enough to filter on. */
export const TEMPLATE_EXT = '.printrow.json';

/** A filesystem-safe stem from a template name, never empty. */
export function fileNameFor(template: Template): string {
	const stem =
		template.name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 60) || 'label';
	return stem + TEMPLATE_EXT;
}

/** Serialize for export. Pretty-printed so the file diffs usefully in git. */
export function toJson(template: Template): string {
	return JSON.stringify(template, null, 2);
}

/**
 * Parse an imported file, giving it a FRESH id.
 *
 * A new id is the important part: importing a template that came from this
 * same browser would otherwise silently overwrite the copy already in the
 * library, which is never what "import" is asked to mean.
 */
export function fromJson(text: string): Template {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		throw new Error('that file is not JSON');
	}
	const parsed = TemplateSchema.safeParse(raw);
	if (!parsed.success) throw new Error('that file is not a printrow template');
	return { ...parsed.data, id: crypto.randomUUID() };
}
