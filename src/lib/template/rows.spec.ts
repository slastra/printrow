import { describe, expect, test } from 'bun:test';
import { describeRows, parseRowSpec } from './rows';

const idx = (spec: string, total = 20) => parseRowSpec(spec, total).indices;
const err = (spec: string, total = 20) => parseRowSpec(spec, total).error;

describe('parseRowSpec', () => {
	test('blank selects nothing without complaining', () => {
		expect(parseRowSpec('', 20)).toEqual({ indices: [], error: null });
		expect(parseRowSpec('   ', 20)).toEqual({ indices: [], error: null });
	});

	test('single row is 1-based in, 0-based out', () => {
		expect(idx('1')).toEqual([0]);
		expect(idx('20')).toEqual([19]);
	});

	test('ranges are inclusive at both ends', () => {
		expect(idx('1-5')).toEqual([0, 1, 2, 3, 4]);
	});

	test('mixed lists', () => {
		expect(idx('1-3, 8, 12-13')).toEqual([0, 1, 2, 7, 11, 12]);
	});

	test('whitespace and empty segments are tolerated', () => {
		expect(idx(' 2 , , 4 ')).toEqual([1, 3]);
		expect(idx('1 - 3')).toEqual([0, 1, 2]);
	});

	test('sorted and deduplicated, so document order always wins', () => {
		expect(idx('3, 1-2, 3')).toEqual([0, 1, 2]);
		expect(idx('9, 4')).toEqual([3, 8]);
	});

	test('open-ended ranges', () => {
		expect(idx('18-')).toEqual([17, 18, 19]);
		expect(idx('-3')).toEqual([0, 1, 2]);
	});

	test('a reversed range is read as intended, not rejected', () => {
		expect(idx('5-3')).toEqual([2, 3, 4]);
	});

	test('out of range is refused rather than clamped', () => {
		expect(err('21')).toBe('21 is outside 1-20');
		expect(err('0')).toBe('0 is outside 1-20');
		expect(err('15-25')).toBe('15-25 is outside 1-20');
		expect(idx('21')).toEqual([]);
	});

	test('garbage is refused', () => {
		expect(err('abc')).toBe('"abc" is not a row or range');
		expect(err('1;2')).toBe('"1;2" is not a row or range');
		expect(err('-')).toBe('"-" is not a row or range');
	});

	test('no rows loaded', () => {
		expect(parseRowSpec('1', 0)).toEqual({ indices: [], error: 'No rows loaded' });
	});
});

describe('describeRows', () => {
	test('collapses runs back into ranges', () => {
		expect(describeRows([0, 1, 2, 3, 4])).toBe('1-5');
		expect(describeRows([0, 1, 2, 7, 11, 12])).toBe('1-3, 8, 12-13');
	});

	test('singles stay single', () => {
		expect(describeRows([4])).toBe('5');
		expect(describeRows([0, 2, 4])).toBe('1, 3, 5');
	});

	test('empty', () => {
		expect(describeRows([])).toBe('');
	});

	test('round-trips through parseRowSpec', () => {
		const spec = '2-4, 9, 15-17';
		expect(describeRows(parseRowSpec(spec, 20).indices)).toBe(spec);
	});
});
