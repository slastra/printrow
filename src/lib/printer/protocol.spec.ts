import { describe, expect, test } from 'bun:test';
import { selftest, encodeRaster, decodeRaster, WIDTH } from './protocol';

describe('protocol', () => {
	test('capture-derived vectors pass (crc, raster runs, framing)', () => {
		expect(selftest()).toEqual([]);
	});

	test('raster codec round-trips arbitrary rows', () => {
		const row = new Uint8Array(WIDTH);
		for (let x = 0; x < WIDTH; x++) row[x] = x % 3 === 0 ? 1 : 0;
		const decoded = decodeRaster(encodeRaster([row]));
		expect(decoded).toHaveLength(1);
		expect([...decoded[0]]).toEqual([...row]);
	});
});
