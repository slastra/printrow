import { describe, expect, test } from 'bun:test';
import {
	DEFAULT_FORMAT,
	extractVars,
	formatValue,
	interpolate,
	resolveValues,
	unknownVars,
	varsInString
} from './vars';
import { ColumnFormatSchema, TemplateSchema } from './schema';

const fmt = (patch: Record<string, unknown>) => ColumnFormatSchema.parse(patch);

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

describe('formatValue', () => {
	test('passes text through untouched by default', () => {
		expect(formatValue('Cedar Widget', DEFAULT_FORMAT)).toBe('Cedar Widget');
		expect(formatValue(undefined)).toBe('');
	});

	test('case transforms', () => {
		expect(formatValue('cedar widget', fmt({ transform: 'upper' }))).toBe('CEDAR WIDGET');
		expect(formatValue('Cedar Widget', fmt({ transform: 'lower' }))).toBe('cedar widget');
		expect(formatValue('cedar WIDGET', fmt({ transform: 'title' }))).toBe('Cedar Widget');
	});

	test('decimals and thousands apply only to numeric text', () => {
		expect(formatValue('1234.5', fmt({ kind: 'number', decimals: 2, thousands: true }))).toBe(
			'1,234.50'
		);
		expect(formatValue('Widget', fmt({ kind: 'number', decimals: 2 }))).toBe('Widget');
	});

	test('affixes wrap the formatted value', () => {
		expect(formatValue('4.5', fmt({ kind: 'number', decimals: 2, prefix: '$' }))).toBe('$4.50');
		expect(formatValue('250', fmt({ suffix: ' pcs' }))).toBe('250 pcs');
	});

	test('maxChars truncates with an ellipsis, counting affixes', () => {
		expect(formatValue('Thermistor NTC 100K', fmt({ maxChars: 10 }))).toBe('Thermisto…');
		expect(formatValue('short', fmt({ maxChars: 10 }))).toBe('short');
	});
});

describe('resolveValues', () => {
	test('formats each column and keys by column name', () => {
		const row = { sku: 'inv-1', price: '4.5' };
		expect(
			resolveValues(row, {
				sku: fmt({ transform: 'upper' }),
				price: fmt({ kind: 'number', decimals: 2 })
			})
		).toEqual({ sku: 'INV-1', price: '4.50' });
	});

	test('no row yields no values', () => {
		expect(resolveValues(undefined)).toEqual({});
	});
});

describe('unknownVars', () => {
	test('flags variables with no matching column', () => {
		const t = TemplateSchema.parse({
			id: 't',
			elements: [{ id: 'a', type: 'text', x: 0, y: 0, w: 80, h: 20, text: '{{sku}} {{nope}}' }]
		});
		expect(unknownVars(t, ['sku', 'price'])).toEqual(['nope']);
	});
});

describe('formatValue kinds', () => {
	test('currency renders symbol or code', () => {
		expect(formatValue('4.5', fmt({ kind: 'currency' }))).toBe('$4.50');
		expect(formatValue('4.5', fmt({ kind: 'currency', currency: 'EUR' }))).toBe('€4.50');
		expect(formatValue('1234.5', fmt({ kind: 'currency', currencyCode: true }))).toBe(
			'USD 1,234.50'
		);
	});

	test('number kind is required for decimal padding', () => {
		expect(formatValue('4.5', fmt({ decimals: 2 }))).toBe('4.5');
		expect(formatValue('4.5', fmt({ kind: 'number', decimals: 2 }))).toBe('4.50');
	});

	test('date patterns, parsed as calendar dates (no timezone drift)', () => {
		const d = (pattern: string) =>
			formatValue('2026-07-25', fmt({ kind: 'date', datePattern: pattern }));
		expect(d('iso')).toBe('2026-07-25');
		expect(d('us')).toBe('07/25/2026');
		expect(d('eu')).toBe('25/07/2026');
		expect(d('medium')).toBe('Jul 25, 2026');
		expect(d('long')).toBe('July 25, 2026');
		expect(d('day-month')).toBe('25 Jul 2026');
		expect(d('compact')).toBe('25Jul26');
	});

	test('accepts US and dotted date input', () => {
		expect(formatValue('7/25/2026', fmt({ kind: 'date' }))).toBe('2026-07-25');
		expect(formatValue('25.07.2026', fmt({ kind: 'date' }))).toBe('2026-07-25');
	});

	test('values that do not fit the kind pass through', () => {
		expect(formatValue('n/a', fmt({ kind: 'currency' }))).toBe('n/a');
		expect(formatValue('someday', fmt({ kind: 'date' }))).toBe('someday');
	});
});
