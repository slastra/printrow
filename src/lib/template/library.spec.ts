import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { blankTemplate, type Template } from './schema';
import {
	deleteTemplate,
	fileNameFor,
	fromJson,
	getTemplate,
	listTemplates,
	migrateLegacyAutosave,
	putTemplate,
	readCurrentId,
	toJson,
	writeCurrentId
} from './library';

// Bun has neither API. Both are installed for this file only, so no other spec
// runs against storage it did not ask for.
const store = new Map<string, string>();
const memoryStorage = {
	getItem: (k: string) => store.get(k) ?? null,
	setItem: (k: string, v: string) => void store.set(k, String(v)),
	removeItem: (k: string) => void store.delete(k),
	clear: () => store.clear()
};

beforeAll(() => {
	Object.assign(globalThis, {
		indexedDB: new IDBFactory(),
		IDBKeyRange,
		localStorage: memoryStorage
	});
});

afterAll(() => {
	for (const key of ['indexedDB', 'IDBKeyRange', 'localStorage']) {
		delete (globalThis as Record<string, unknown>)[key];
	}
});

beforeEach(async () => {
	store.clear();
	for (const { id } of await listTemplates()) await deleteTemplate(id);
});

function named(name: string): Template {
	return { ...blankTemplate(), name };
}

describe('the library', () => {
	test('a saved template comes back as it went in', async () => {
		const t = named('Shelf tags');
		await putTemplate(t);
		expect(await getTemplate(t.id)).toEqual(t);
	});

	test('a missing id is null, not a throw', async () => {
		expect(await getTemplate('nope')).toBeNull();
	});

	test('lists newest first', async () => {
		const older = named('older');
		const newer = named('newer');
		await putTemplate(older);
		await Bun.sleep(2);
		await putTemplate(newer);
		expect((await listTemplates()).map((e) => e.name)).toEqual(['newer', 'older']);
	});

	test('a resave moves a template back to the top', async () => {
		const a = named('a');
		const b = named('b');
		await putTemplate(a);
		await Bun.sleep(2);
		await putTemplate(b);
		await Bun.sleep(2);
		await putTemplate({ ...a, name: 'a, edited' });
		const list = await listTemplates();
		expect(list.map((e) => e.name)).toEqual(['a, edited', 'b']);
		expect(list.length).toBe(2);
	});

	test('delete removes it from both the list and lookup', async () => {
		const t = named('gone');
		await putTemplate(t);
		await deleteTemplate(t.id);
		expect(await getTemplate(t.id)).toBeNull();
		expect(await listTemplates()).toEqual([]);
	});

	test('a stored record that no longer parses reads as missing', async () => {
		// what an older or corrupted build could have left behind
		const t = named('broken');
		await putTemplate({ ...t, width: 'wide' } as unknown as Template);
		expect(await getTemplate(t.id)).toBeNull();
	});
});

describe('the open-template pointer', () => {
	test('remembers the last id written', () => {
		expect(readCurrentId()).toBeNull();
		writeCurrentId('abc');
		expect(readCurrentId()).toBe('abc');
	});

	test('a browser with storage disabled reads null and writes nothing', () => {
		const saved = globalThis.localStorage;
		Object.assign(globalThis, {
			localStorage: {
				getItem() {
					throw new Error('denied');
				},
				setItem() {
					throw new Error('denied');
				}
			}
		});
		try {
			expect(readCurrentId()).toBeNull();
			expect(() => writeCurrentId('abc')).not.toThrow();
		} finally {
			Object.assign(globalThis, { localStorage: saved });
		}
	});
});

describe('migrating the old autosave', () => {
	const LEGACY_KEY = 'printrow:template:v1';

	test('moves it into the library and hands it back to open', async () => {
		const t = named('from before the library');
		store.set(LEGACY_KEY, JSON.stringify(t));
		expect(await migrateLegacyAutosave()).toEqual(t);
		expect(await getTemplate(t.id)).toEqual(t);
	});

	test('keeps the legacy copy, in case this build is rolled back', async () => {
		store.set(LEGACY_KEY, JSON.stringify(named('keep me')));
		await migrateLegacyAutosave();
		expect(store.has(LEGACY_KEY)).toBe(true);
	});

	test('never overwrites a copy edited since the first migration', async () => {
		const t = named('original');
		store.set(LEGACY_KEY, JSON.stringify(t));
		await migrateLegacyAutosave();
		await putTemplate({ ...t, name: 'edited since' });
		expect(await migrateLegacyAutosave()).toBeNull();
		expect((await getTemplate(t.id))?.name).toBe('edited since');
	});

	test('nothing, junk, and invalid templates all migrate nothing', async () => {
		expect(await migrateLegacyAutosave()).toBeNull();
		store.set(LEGACY_KEY, '{not json');
		expect(await migrateLegacyAutosave()).toBeNull();
		store.set(LEGACY_KEY, JSON.stringify({ width: 'wide' }));
		expect(await migrateLegacyAutosave()).toBeNull();
		expect(await listTemplates()).toEqual([]);
	});
});

describe('files', () => {
	test('a name becomes a safe, distinctive file name', () => {
		expect(fileNameFor(named('Shelf Tags: Aisle 4!'))).toBe('shelf-tags-aisle-4.printrow.json');
		expect(fileNameFor(named('***'))).toBe('label.printrow.json');
		expect(fileNameFor(named('x'.repeat(100)))).toBe('x'.repeat(60) + '.printrow.json');
	});

	test('import round-trips export, under a fresh id', () => {
		const t = named('round trip');
		const back = fromJson(toJson(t));
		expect(back.id).not.toBe(t.id);
		expect({ ...back, id: t.id }).toEqual(t);
	});

	test('import says which way a bad file is bad', () => {
		expect(() => fromJson('{not json')).toThrow('not JSON');
		expect(() => fromJson('{"width":"wide"}')).toThrow('not a printrow template');
	});
});
