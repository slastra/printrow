import { afterAll, beforeEach, describe, expect, setSystemTime, test } from 'bun:test';
import { EditorState } from './editor.svelte';
import { toJson } from './library';
import { blankTemplate } from './schema';

let now = 1_000_000;
/** Move the clock on, so the next commit does or does not coalesce. */
function wait(ms: number) {
	now += ms;
	setSystemTime(new Date(now));
}

let ed: EditorState;
beforeEach(() => {
	wait(10_000);
	ed = new EditorState();
});

afterAll(async () => {
	setSystemTime();
	// let the autosave timers the tests started fire here, rather than into
	// whichever spec runs next
	await Bun.sleep(450);
});

const count = () => ed.template.elements.length;

describe('undo and redo', () => {
	test('undo takes back an add, redo puts it back', () => {
		ed.add('text');
		expect(count()).toBe(1);
		ed.undo();
		expect(count()).toBe(0);
		expect(ed.canRedo).toBe(true);
		ed.redo();
		expect(count()).toBe(1);
	});

	test('a fresh edit after an undo drops the redo branch', () => {
		ed.add('text');
		ed.undo();
		ed.add('rect');
		expect(ed.canRedo).toBe(false);
		expect(ed.template.elements[0].type).toBe('rect');
	});

	test('a burst of edits undoes as one step', () => {
		ed.add('text');
		const id = ed.template.elements[0].id;
		wait(1000);
		for (let i = 0; i < 5; i++) {
			ed.nudge(1, 0);
			wait(100);
		}
		const x = ed.byId(id)!.x;
		ed.undo();
		expect(ed.byId(id)!.x).toBe(x - 5);
		expect(count()).toBe(1);
	});

	test('edits further apart than the coalesce window are separate steps', () => {
		ed.add('text');
		const id = ed.template.elements[0].id;
		wait(1000);
		ed.nudge(1, 0);
		wait(600);
		ed.nudge(1, 0);
		ed.undo();
		const after1 = ed.byId(id)!.x;
		ed.undo();
		expect(ed.byId(id)!.x).toBe(after1 - 1);
	});

	test('the first edit after an undo never coalesces into it', () => {
		ed.add('text');
		wait(1000);
		ed.add('rect');
		ed.undo();
		// no time passes: without the boundary this would fold into the undo
		ed.add('rect');
		ed.undo();
		expect(ed.template.elements.map((e) => e.type)).toEqual(['text']);
	});

	test('history keeps the last hundred steps', () => {
		for (let i = 0; i < 120; i++) {
			ed.add('rect');
			wait(600);
		}
		let undone = 0;
		while (ed.canUndo) {
			ed.undo();
			undone++;
		}
		expect(undone).toBe(100);
		expect(count()).toBe(20);
	});

	test('undoing an add drops the removed element from the selection', () => {
		ed.add('text');
		expect(ed.selectedIds.length).toBe(1);
		ed.undo();
		expect(ed.selectedIds).toEqual([]);
	});

	test('images survive the round trip through history intact', () => {
		const dataUrl = 'data:image/png;base64,' + 'A'.repeat(2000);
		ed.add('image', { dataUrl, w: 40, h: 40 });
		const id = ed.template.elements[0].id;
		wait(1000);
		ed.nudge(4, 0);
		ed.undo();
		ed.redo();
		ed.undo();
		const el = ed.byId(id);
		expect(el?.type === 'image' && el.dataUrl).toBe(dataUrl);
	});
});

describe('the mutation funnel', () => {
	test('an out-of-range patch is refused and leaves no history step', () => {
		ed.add('text');
		const id = ed.template.elements[0].id;
		wait(1000);
		ed.updateById(id, { fontSize: 9999 } as never);
		ed.undo();
		expect(count()).toBe(0);
	});

	test('gestures land on whole dots and keep a sliver on the label', () => {
		ed.add('rect');
		const id = ed.template.elements[0].id;
		ed.updateGeometry(id, { x: 10.6, w: 50.4, rotation: -90.2 });
		const el = ed.byId(id)!;
		expect([el.x, el.w, el.rotation]).toEqual([11, 50, 270]);
		ed.updateGeometry(id, { x: 100_000, y: -100_000 });
		expect(ed.byId(id)!.x).toBeLessThan(ed.template.width);
		expect(ed.byId(id)!.y + ed.byId(id)!.h).toBeGreaterThan(0);
	});
});

describe('switching templates', () => {
	test('undo never reaches back into the previous template', async () => {
		ed.add('text');
		await ed.importFile(toJson({ ...blankTemplate(), name: 'other' }));
		expect(ed.template.name).toBe('other');
		expect(ed.canUndo).toBe(false);
		expect(ed.canRedo).toBe(false);
	});
});
