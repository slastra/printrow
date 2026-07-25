import { describe, expect, test } from 'bun:test';
import { blankTemplate, ElementSchema, TemplateSchema } from './schema';

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
	});

	test('round-trips through JSON unchanged', () => {
		const t = TemplateSchema.parse({
			id: 't',
			elements: [{ id: 'b', type: 'barcode', x: 1, y: 2, w: 100, h: 50, data: '{{sku}}' }]
		});
		expect(TemplateSchema.parse(JSON.parse(JSON.stringify(t)))).toEqual(t);
	});
});
