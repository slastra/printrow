import { describe, expect, test } from 'bun:test';
import { leadFeed } from './feed';

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
