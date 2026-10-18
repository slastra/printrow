import { describe, expect, test } from 'bun:test';
import { barcodePlacement } from './barcode';

describe('barcodePlacement', () => {
	test('a 1D code scales its width by a whole number and fills the height', () => {
		// 95 modules into 300 dots: 3 dots a module, 15 left over as quiet zone
		const p = barcodePlacement({ width: 95, height: 1 }, { bcid: 'ean13', w: 300, h: 80 });
		expect(p).toEqual({ x: 7, y: 0, w: 285, h: 80 });
	});

	test('never a fractional module, even just short of the next scale', () => {
		const p = barcodePlacement({ width: 100, height: 1 }, { bcid: 'code128', w: 299, h: 40 });
		expect(p.w).toBe(200);
		expect(p.w % 100).toBe(0);
	});

	test('a 2D code keeps its modules square, limited by the tighter side', () => {
		// 25×25 into a wide box: the 110-dot height allows 4, the width 8
		const p = barcodePlacement({ width: 25, height: 25 }, { bcid: 'qrcode', w: 200, h: 110 });
		expect(p).toEqual({ x: 50, y: 5, w: 100, h: 100 });
	});

	test('datamatrix is square-scaled too', () => {
		const p = barcodePlacement({ width: 10, height: 10 }, { bcid: 'datamatrix', w: 35, h: 60 });
		expect([p.w, p.h]).toEqual([30, 30]);
	});

	test('a box smaller than the code overhangs at scale 1 rather than dropping modules', () => {
		const p = barcodePlacement({ width: 120, height: 1 }, { bcid: 'code128', w: 100, h: 30 });
		expect(p).toEqual({ x: -10, y: 0, w: 120, h: 30 });
	});
});
