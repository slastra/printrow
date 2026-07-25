import { describe, expect, test } from 'bun:test';
import { autoMap, extractVars, interpolate, varsInString } from './vars';
import { TemplateSchema } from './schema';

describe('varsInString', () => {
	test('finds, dedupes, and preserves order', () => {
		expect(varsInString('{{sku}} {{ name }} {{sku}}')).toEqual(['sku', 'name']);
	});

	test('allows dots and dashes, ignores stray braces', () => {
		expect(varsInString('{{lot-no}} {{a.b}} {{}} {{ }} plain')).toEqual(['lot-no', 'a.b']);
	});
});

describe('extractVars', () => {
	test('scans text and barcode elements in element order', () => {
		const t = TemplateSchema.parse({
			id: 't1',
			elements: [
				{ id: 'a', type: 'text', x: 0, y: 0, w: 100, h: 40, text: '{{name}} — {{size}}' },
				{ id: 'b', type: 'barcode', x: 0, y: 50, w: 100, h: 40, data: '{{sku}}' },
				{ id: 'c', type: 'rect', x: 0, y: 100, w: 20, h: 20 }
			]
		});
		expect(extractVars(t)).toEqual(['name', 'size', 'sku']);
	});
});

describe('interpolate', () => {
	test('substitutes known vars and leaves unknown placeholders visible', () => {
		expect(interpolate('{{a}}-{{b}}', { a: 'x' })).toBe('x-{{b}}');
	});

	test('empty string is a valid value, not a miss', () => {
		expect(interpolate('[{{a}}]', { a: '' })).toBe('[]');
	});
});

describe('autoMap', () => {
	test('matches case- and separator-insensitively', () => {
		expect(autoMap(['lot_no', 'sku', 'missing'], ['Lot No', 'SKU'])).toEqual({
			lot_no: 'Lot No',
			sku: 'SKU'
		});
	});
});
