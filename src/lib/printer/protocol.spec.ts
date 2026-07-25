import { describe, expect, test } from 'bun:test';
import { selftest, encodeRaster, decodeRaster, buildStream, toHex, WIDTH } from './protocol';

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

describe('buildStream guards', () => {
	const row = (n: number) => new Uint8Array(n);

	test('accepts rows exactly the media width', () => {
		expect(() => buildStream([row(400), row(400)], 50)).not.toThrow();
		expect(() => buildStream([row(320)], 40)).not.toThrow();
	});

	test('refuses a raster whose rows are the wrong width', () => {
		// this is what a mis-cropped canvas export produced: 420-px rows sent
		// as 50 mm media, which shifts every row marker at the printer
		expect(() => buildStream([row(420)], 50)).toThrow(/expected 400/);
		expect(() => buildStream([row(400)], 40)).toThrow(/expected 320/);
	});

	test('refuses a ragged raster', () => {
		expect(() => buildStream([row(400), row(399)], 50)).toThrow(/row 1/);
	});

	test('carries the media width in the setup frames', () => {
		expect(toHex(buildStream([row(320)], 40))).toContain('05380402' + '28' + '00');
		expect(toHex(buildStream([row(400)], 50))).toContain('05380402' + '32' + '00');
	});
});
