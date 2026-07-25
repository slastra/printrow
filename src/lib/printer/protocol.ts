// Y50P protocol, ported from tspl-bluetooth-print (see its FINDINGS.md).
//
//   frame  := 1a 01 <len:u16 LE> <payload:len> <crc32:u32 LE> a1
//   crc32  := reflected CRC-32, poly 0xEDB88320, init 0xCA896ADE,
//             xorout 0xFFFFFFFF, over the payload only
//   raster := (0x18 <run>*)*  run = <colour:1><count-1:7>, rows of 400 px
//
// Pure and DOM-free on purpose: the browser UI imports it, and so can any
// node-side cross-check that diffs its output against the Python implementation.

export const WIDTH = 400,
	HEIGHT = 240,
	ROW_MARK = 0x18;
const CRC_INIT = 0xca896ade;

const CRC_TABLE = (() => {
	const t = new Uint32Array(256);
	for (let i = 0; i < 256; i++) {
		let c = i;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		t[i] = c >>> 0;
	}
	return t;
})();

export function crc32(bytes: Uint8Array): number {
	let r = CRC_INIT >>> 0;
	for (let i = 0; i < bytes.length; i++) {
		r = ((r >>> 8) ^ CRC_TABLE[(r ^ bytes[i]) & 0xff]) >>> 0;
	}
	return (r ^ 0xffffffff) >>> 0;
}

export function hexToBytes(hex: string): Uint8Array {
	const out = new Uint8Array(hex.length / 2);
	for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
	return out;
}

export const toHex = (b: Uint8Array | number[]): string =>
	[...b].map((x) => x.toString(16).padStart(2, '0')).join('');

export function frame(payload: string | Uint8Array): Uint8Array {
	if (typeof payload === 'string') payload = hexToBytes(payload);
	const n = payload.length,
		c = crc32(payload);
	const out = new Uint8Array(n + 9);
	out[0] = 0x1a;
	out[1] = 0x01;
	out[2] = n & 0xff;
	out[3] = (n >> 8) & 0xff;
	out.set(payload, 4);
	out[4 + n] = c & 0xff;
	out[5 + n] = (c >>> 8) & 0xff;
	out[6 + n] = (c >>> 16) & 0xff;
	out[7 + n] = (c >>> 24) & 0xff;
	out[8 + n] = 0xa1;
	return out;
}

// dir byte: 01 request, 02 reply, 03 event, 04 set
export function request(group: number, cmd: number): Uint8Array {
	return frame(new Uint8Array([group, cmd, 0x01, 0x00, 0x00]));
}

/**
 * Session setup frames. The 0x41 (canvas width) and 0x38 (print width) frames
 * carry the media width in millimetres — only 50 mm is hardware-verified;
 * other widths follow the captured frame format but are untested on stock.
 */
export function preamble(widthMm = 50): string[] {
	const w = (widthMm & 0xff).toString(16).padStart(2, '0');
	return [
		'0104010000',
		'0104010000',
		'01b7010000',
		'0107010000',
		'0102010000',
		'050b010000',
		'050b010000',
		'050b010000',
		'050b010000',
		'050b010000',
		'050b010000',
		'052001010000',
		'051101010008',
		'0519010000',
		'0536010000',
		'050b010000',
		// <group><cmd><dir><len:u16 LE = 2><value:u16 LE = width mm>
		`0541040200${w}00`,
		`0538040200${w}00`,
		'05400402000000'
	];
}

export const PREAMBLE = preamble(50);

// 0x21 closes the raster; 0x37 and 0x1a feed the label to the tear bar.
// Without the latter two the paper stops as soon as the last row clears the
// head, leaving the label half-presented.
export const TRAILER = ['0521010000', '0537010000', '051a010000', ...Array(10).fill('050b010000')];

/** One row of 1-bit pixels, 0 = white, 1 = black. Row length = media width in dots. */
export type RasterRow = Uint8Array;

export function encodeRaster(rows: RasterRow[]): Uint8Array {
	const out: number[] = [];
	for (const row of rows) {
		out.push(ROW_MARK);
		let i = 0;
		while (i < row.length) {
			const colour = row[i];
			let run = 1;
			while (i + run < row.length && row[i + run] === colour && run < 128) run++;
			out.push((colour << 7) | (run - 1));
			i += run;
		}
	}
	return Uint8Array.from(out);
}

export function decodeRaster(blob: Uint8Array, width = WIDTH): RasterRow[] {
	const rows: RasterRow[] = [];
	let i = 0;
	while (i < blob.length) {
		if (blob[i] !== ROW_MARK) throw new Error(`no row marker at ${i}`);
		i++;
		const row = new Uint8Array(width);
		let x = 0;
		while (x < width) {
			if (i >= blob.length) throw new Error(`truncated row ${rows.length}`);
			const b = blob[i++],
				colour = b >> 7,
				n = (b & 0x7f) + 1;
			if (x + n > width) throw new Error(`row ${rows.length} overran`);
			row.fill(colour, x, x + n);
			x += n;
		}
		rows.push(row);
	}
	return rows;
}

export function buildStream(
	rows: RasterRow[],
	widthMm = 50,
	job = 0x08,
	trailer: string[] = TRAILER
): Uint8Array {
	// The printer reads rows back-to-back with no length field: a row that
	// isn't exactly the media width shifts every following row marker and can
	// hang the firmware. Refuse rather than transmit that.
	const dots = widthMm * 8;
	for (const [i, row] of rows.entries()) {
		if (row.length !== dots) {
			throw new Error(`raster row ${i} is ${row.length} px, expected ${dots} for ${widthMm} mm`);
		}
	}
	const parts = preamble(widthMm).map((p) => frame(p));
	parts.push(frame(new Uint8Array([0x05, 0x39, 0x04, 0x01, 0x00, job & 0xff])));
	parts.push(encodeRaster(rows));
	for (const p of trailer) parts.push(frame(p));
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let o = 0;
	for (const p of parts) {
		out.set(p, o);
		o += p.length;
	}
	return out;
}

export interface Reply {
	group: number;
	cmd: number;
	dir: number;
	/** Decoded integer for dtype 0x03 replies, raw bytes otherwise. */
	value: number | Uint8Array;
}

export function parseReplies(buf: Uint8Array): Reply[] {
	const out: Reply[] = [];
	let i = 0;
	while (i + 9 <= buf.length) {
		if (buf[i] !== 0x1a || buf[i + 1] !== 0x01) {
			i++;
			continue;
		}
		const len = buf[i + 2] | (buf[i + 3] << 8);
		const end = i + 4 + len + 4;
		if (end >= buf.length || buf[end] !== 0xa1) {
			i++;
			continue;
		}
		const payload = buf.slice(i + 4, i + 4 + len);
		const want =
			(buf[end - 4] | (buf[end - 3] << 8) | (buf[end - 2] << 16) | (buf[end - 1] << 24)) >>> 0;
		if (crc32(payload) === want && len >= 5) {
			const dataLen = payload[3] | (payload[4] << 8);
			const data = payload.slice(5, 5 + dataLen);
			let value: number | Uint8Array = data;
			// Only replies carry <dtype><vlen><value>; events do not.
			if (payload[2] === 0x02 && data.length >= 3) {
				const vlen = data[1] | (data[2] << 8);
				const raw = data.slice(3, 3 + vlen);
				value = data[0] === 0x03 ? [...raw].reduce((n, b, k) => n + b * 2 ** (8 * k), 0) : raw;
			}
			out.push({ group: payload[0], cmd: payload[1], dir: payload[2], value });
		}
		i = end + 1;
	}
	return out;
}

// 0x02/0x04 measured on hardware; 0x01/0x08/0x10 from
// Souukou/OpenBluetoothPrinter's work on the sibling FlashToy U8.
// Cover-open forces the paper bit (the sensor rides up with the head), so 0x02
// never appears alone and reporting both would mislead.
export const STATUS_FLAGS: [number, string][] = [
	[0x01, 'printing'],
	[0x02, 'cover open'],
	[0x04, 'out of paper'],
	[0x08, 'under voltage'],
	[0x10, 'overheat']
];

export function describeStatus(v: number): string {
	if (v === 0) return 'ready';
	let flags = STATUS_FLAGS.filter(([bit]) => v & bit).map(([, name]) => name);
	if (v & 0x02) flags = flags.filter((n) => n !== 'out of paper');
	const rest = v & ~STATUS_FLAGS.reduce((n, [bit]) => n | bit, 0);
	if (rest) flags.push(`unknown bits 0x${rest.toString(16).padStart(2, '0')}`);
	return flags.join(', ') || `unknown (0x${v.toString(16).padStart(2, '0')})`;
}

// Vectors taken from real captures. A silently wrong port would otherwise just
// emit garbage at the printer.
export function selftest(): string[] {
	const fails: string[] = [];
	const check = (name: string, got: string | number, want: string | number) => {
		if (got !== want) fails.push(`${name}: got ${got}, want ${want}`);
	};
	check('crc 050b010000', crc32(hexToBytes('050b010000')), 0x5c73542d);
	check('crc 0104010000', crc32(hexToBytes('0104010000')), 0xf190e2bb);
	check('crc 053904010013', crc32(hexToBytes('053904010013')), 0xfec2f091);

	// all-white row: 128 + 128 + 128 + 16 = 400 px
	check('white row', toHex(encodeRaster([new Uint8Array(WIDTH)])), '187f7f7f0f');

	// 4 black px at x=198 -> 128w 70w 4b 128w 70w, as in the vertical-line capture
	const vert = new Uint8Array(WIDTH);
	vert.fill(1, 198, 202);
	check('vertical line row', toHex(encodeRaster([vert])), '187f45837f45');

	const f = frame('050b010000');
	check('frame length', f.length, 14);
	check('frame parses', parseReplies(f).length, 1);

	// raster codec round-trips
	const rows = [new Uint8Array(WIDTH), vert];
	check(
		'raster round-trip',
		toHex(encodeRaster(decodeRaster(encodeRaster(rows)))),
		toHex(encodeRaster(rows))
	);
	return fails;
}
