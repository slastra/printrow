import { describe, expect, test } from 'bun:test';
import { parseCsv } from './csv';

describe('parseCsv', () => {
	test('plain fields, CRLF, trailing newline', () => {
		const { columns, rows } = parseCsv('sku,name\r\nA1,Widget\r\nB2,Gadget\r\n');
		expect(columns).toEqual(['sku', 'name']);
		expect(rows).toEqual([
			{ sku: 'A1', name: 'Widget' },
			{ sku: 'B2', name: 'Gadget' }
		]);
	});

	test('quoted fields with commas, newlines, and escaped quotes', () => {
		const { rows } = parseCsv('a,b\n"x, y","line1\nline2"\n"he said ""hi""",z');
		expect(rows[0]).toEqual({ a: 'x, y', b: 'line1\nline2' });
		expect(rows[1]).toEqual({ a: 'he said "hi"', b: 'z' });
	});

	test('skips blank lines, pads short rows', () => {
		const { rows } = parseCsv('a,b\n\n1\n\n2,3\n');
		expect(rows).toEqual([
			{ a: '1', b: '' },
			{ a: '2', b: '3' }
		]);
	});

	test('names empty headers and dedupes duplicates', () => {
		const { columns } = parseCsv('sku,,sku\n1,2,3');
		expect(columns).toEqual(['sku', 'column2', 'sku (2)']);
	});

	test('strips BOM', () => {
		expect(parseCsv('﻿a\n1').columns).toEqual(['a']);
	});
});
