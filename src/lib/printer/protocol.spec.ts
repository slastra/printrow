import { describe, expect, test } from 'bun:test';
import {
	selftest,
	encodeRaster,
	decodeRaster,
	buildStream,
	preamble,
	PREAMBLE,
	frame,
	hexToBytes,
	parseReplies,
	toHex,
	WIDTH
} from './protocol';

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

	test('the 50 mm preamble is byte-identical to the hardware capture', () => {
		// Pinned to the captured session, not to our own formatting: an earlier
		// bug dropped a byte from the length field here, so every frame after it
		// was misread by the printer. Compare against the capture, always.
		expect(preamble(50)).toEqual(PREAMBLE);
		expect(preamble(50)).toContain('05410402003200');
		expect(preamble(50)).toContain('05380402003200');
	});

	test('every preamble frame parses as a well-formed payload', () => {
		for (const mm of [30, 40, 50]) {
			for (const hex of preamble(mm)) {
				const payload = hexToBytes(hex);
				const declared = payload[3] | (payload[4] << 8);
				// <group><cmd><dir><len:u16><data:len>
				expect(declared).toBe(payload.length - 5);
				// and the frame round-trips through the reply parser
				expect(parseReplies(frame(payload)).length).toBe(1);
			}
		}
	});

	test('carries the media width as a u16 value', () => {
		expect(toHex(buildStream([row(320)], 40))).toContain('0538040200' + '28' + '00');
		expect(toHex(buildStream([row(400)], 50))).toContain('0538040200' + '32' + '00');
	});
});
