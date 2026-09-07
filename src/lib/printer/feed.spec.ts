import { describe, expect, test } from 'bun:test';
import { leadFeed, trimAcross } from './feed';

const raster = [Uint8Array.of(1, 0), Uint8Array.of(0, 1)];

describe('leadFeed', () => {
	test('top-first: blank rows go above the design', () => {
		const out = leadFeed(raster, 2, 'top');
		expect(out.map((r) => [...r])).toEqual([
			[0, 0],
			[0, 0],
			[1, 0],
			[0, 1]
		]);
	});

	test('left-first: blank columns go left of the design', () => {
		const out = leadFeed(raster, 2, 'left');
		expect(out.map((r) => [...r])).toEqual([
			[0, 0, 1, 0],
			[0, 0, 0, 1]
		]);
	});

	test('no lead leaves the raster alone', () => {
		expect(leadFeed(raster, 0, 'top')).toBe(raster);
		expect(leadFeed([], 8, 'left')).toEqual([]);
	});
});

describe('trimAcross', () => {
	const wide = [Uint8Array.of(1, 2, 3, 4, 5, 6), Uint8Array.of(7, 8, 9, 10, 11, 12)];

	test('top-first: the width crosses the head, so columns go from both edges', () => {
		const out = trimAcross(wide, 4, 'top');
		expect(out.map((r) => [...r])).toEqual([
			[2, 3, 4, 5],
			[8, 9, 10, 11]
		]);
	});

	test('left-first: the height crosses the head, so rows go from both edges', () => {
		const tall = [1, 2, 3, 4, 5, 6].map((v) => Uint8Array.of(v));
		expect(trimAcross(tall, 4, 'left').map((r) => r[0])).toEqual([2, 3, 4, 5]);
	});

	test('a 50 mm design on the 48 mm B1 head loses 8 dots a side', () => {
		const row = new Uint8Array(400).fill(1);
		row[7] = 0;
		row[8] = 2;
		row[391] = 3;
		row[392] = 0;
		const [out] = trimAcross([row], 384, 'top');
		expect(out.length).toBe(384);
		expect(out[0]).toBe(2);
		expect(out[383]).toBe(3);
	});

	test('nothing to trim leaves the raster alone', () => {
		expect(trimAcross(wide, 6, 'top')).toBe(wide);
		expect(trimAcross([], 4, 'left')).toEqual([]);
	});
});
