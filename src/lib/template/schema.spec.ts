import { describe, expect, test } from 'bun:test';
import { THRESHOLD } from '@slastra/yplib';
import { blankTemplate, DEFAULT_LINE_HEIGHT, ElementSchema, TemplateSchema } from './schema';

describe('TemplateSchema', () => {
	test('blankTemplate carries Y50P geometry and no column formats', () => {
		const t = blankTemplate();
		expect(t.width).toBe(400);
		expect(t.height).toBe(240);
		expect(t.elements).toEqual([]);
		expect(t.formats).toEqual({});
	});

	test('accepts free-form rotation within 0–360', () => {
		const ok = ElementSchema.safeParse({
			id: 'a',
			type: 'rect',
			x: 0,
			y: 0,
			w: 20,
			h: 20,
			rotation: 37.5
		});
		expect(ok.success).toBe(true);
		const bad = ElementSchema.safeParse({
			id: 'a',
			type: 'rect',
			x: 0,
			y: 0,
			w: 20,
			h: 20,
			rotation: 400
		});
		expect(bad.success).toBe(false);
	});

	test('element defaults fill in', () => {
		const el = ElementSchema.parse({ id: 'a', type: 'text', x: 0, y: 0, w: 100, h: 40, text: '' });
		if (el.type !== 'text') throw new Error('wrong branch');
		expect(el.fontSize).toBe(32);
		expect(el.autoFit).toBe(true);
		expect(el.rotation).toBe(0);
		expect(el.lineHeight).toBe(1.15);
		expect(el.letterSpacing).toBe(0);
	});

	test('line height defaults to the value the renderer used to hardcode', () => {
		// 1.15 lived in nodes.ts as a constant, so every template saved before
		// this field existed was rendered at it. The default is what keeps those
		// looking identical rather than snapping to Konva's own default of 1.
		const box = { id: 'a', type: 'text', x: 0, y: 0, w: 100, h: 40, text: '' };
		const el = ElementSchema.parse(box);
		if (el.type !== 'text') throw new Error('wrong branch');
		expect(el.lineHeight).toBe(DEFAULT_LINE_HEIGHT);
		expect(el.lineHeight).toBe(1.15);
		expect(ElementSchema.parse({ ...box, lineHeight: 2 })).toMatchObject({ lineHeight: 2 });
		expect(ElementSchema.safeParse({ ...box, lineHeight: 0.4 }).success).toBe(false);
		expect(ElementSchema.safeParse({ ...box, lineHeight: 4 }).success).toBe(false);
	});

	test('letter spacing defaults to none and allows tightening', () => {
		const box = { id: 'a', type: 'text', x: 0, y: 0, w: 100, h: 40, text: '' };
		const el = ElementSchema.parse(box);
		if (el.type !== 'text') throw new Error('wrong branch');
		expect(el.letterSpacing).toBe(0);
		// Negative is the point of this assertion. Every other number on an
		// element is non-negative, so a future reflexive .min(0) here would look
		// harmless and would instead make every tightening edit vanish silently
		// at the mutation funnel, which validates rather than clamps.
		expect(ElementSchema.parse({ ...box, letterSpacing: -4 })).toMatchObject({
			letterSpacing: -4
		});
		expect(ElementSchema.safeParse({ ...box, letterSpacing: -20 }).success).toBe(false);
		expect(ElementSchema.safeParse({ ...box, letterSpacing: 100 }).success).toBe(false);
		// whole dots only: a fractional advance only moves antialiasing, which
		// the 1-bit pass discards
		expect(ElementSchema.safeParse({ ...box, letterSpacing: 1.5 }).success).toBe(false);
	});

	test("image cutoff defaults to the printer's own threshold", () => {
		const box = { id: 'a', type: 'image', x: 0, y: 0, w: 100, h: 40, dataUrl: 'data:,' };
		const el = ElementSchema.parse(box);
		if (el.type !== 'image') throw new Error('wrong branch');
		// asserted against the library constant, not the literal, so the editor
		// and the wire rasterizer cannot drift to different defaults
		expect(el.cutoff).toBe(THRESHOLD);
		expect(el.cutoff).toBe(128);
		expect(ElementSchema.parse({ ...box, cutoff: 200 })).toMatchObject({ cutoff: 200 });
		// both ends are degenerate — nothing fires, or everything but pure white
		expect(ElementSchema.safeParse({ ...box, cutoff: 0 }).success).toBe(false);
		expect(ElementSchema.safeParse({ ...box, cutoff: 255 }).success).toBe(false);
	});

	test('text vertical alignment defaults to top and rejects junk', () => {
		// existing templates have no verticalAlign, so the default is what keeps
		// an old autosave parsing and looking exactly as it did
		const box = { id: 'a', type: 'text', x: 0, y: 0, w: 100, h: 40, text: '' };
		const el = ElementSchema.parse(box);
		if (el.type !== 'text') throw new Error('wrong branch');
		expect(el.verticalAlign).toBe('top');
		expect(ElementSchema.parse({ ...box, verticalAlign: 'middle' })).toMatchObject({
			verticalAlign: 'middle'
		});
		expect(ElementSchema.safeParse({ ...box, verticalAlign: 'centre' }).success).toBe(false);
	});

	test('ink defaults to black on every element type', () => {
		// every template saved before ink existed omits the field, so the default
		// is what stops an old autosave from failing to parse
		const box = { id: 'a', x: 0, y: 0, w: 100, h: 40 };
		const els = [
			{ ...box, type: 'text', text: '' },
			{ ...box, type: 'barcode', data: '1' },
			{ ...box, type: 'image', dataUrl: 'data:,' },
			{ ...box, type: 'icon', name: 'star' },
			{ ...box, type: 'rect' }
		];
		for (const raw of els) expect(ElementSchema.parse(raw).ink).toBe('black');
	});

	test('ink accepts clear and rejects anything else', () => {
		const box = { id: 'a', type: 'rect', x: 0, y: 0, w: 100, h: 40 };
		expect(ElementSchema.parse({ ...box, ink: 'clear' }).ink).toBe('clear');
		expect(ElementSchema.safeParse({ ...box, ink: 'white' }).success).toBe(false);
	});

	test('round-trips through JSON unchanged', () => {
		const t = TemplateSchema.parse({
			id: 't',
			elements: [{ id: 'b', type: 'barcode', x: 1, y: 2, w: 100, h: 50, data: '{{sku}}' }]
		});
		expect(TemplateSchema.parse(JSON.parse(JSON.stringify(t)))).toEqual(t);
	});
});
