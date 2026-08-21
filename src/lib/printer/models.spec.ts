import { describe, expect, test } from 'bun:test';
import {
	MAX_PRINTHEAD_DOTS,
	MODELS,
	MODEL_LIST,
	acrossHeadDots,
	fitsPrinter,
	printableWidthMm
} from './models';
import { MEDIA_PRESETS, DOTS_PER_MM, TemplateSchema } from '$lib/template/schema';

const dots = (wMm: number, hMm: number) => ({
	width: wMm * DOTS_PER_MM,
	height: hMm * DOTS_PER_MM
});

describe('print head widths', () => {
	test('the B1 is 48 mm, not the 50 mm its stock is', () => {
		expect(MODELS.b1.printheadDots).toBe(384);
		expect(printableWidthMm(MODELS.b1)).toBe(48);
	});

	test('the Y50P is 50 mm', () => {
		expect(printableWidthMm(MODELS.y50p)).toBe(50);
	});

	test('the schema bound covers every model, so no model can outgrow it', () => {
		// If this fails, a template valid for the new printer would be rejected
		// by TemplateSchema on load and the whole design discarded.
		for (const m of MODEL_LIST) expect(m.printheadDots).toBeLessThanOrEqual(MAX_PRINTHEAD_DOTS);
	});
});

describe('which dimension crosses the head', () => {
	test('top feeds the width across', () => {
		expect(acrossHeadDots(dots(50, 30), 'top')).toBe(400);
	});

	test('left rotates a quarter turn, so the height crosses instead', () => {
		expect(acrossHeadDots(dots(50, 30), 'left')).toBe(240);
	});
});

describe('fitsPrinter', () => {
	test("printrow's 50 mm default does not fit the B1", () => {
		const fit = fitsPrinter(dots(50, 30), 'top', MODELS.b1);
		expect(fit.fits).toBe(false);
		expect(fit.across).toBe(400);
		expect(fit.reason).toBe('50 mm across the head, and the NIIMBOT B1 prints 48 mm');
	});

	test('48 mm does', () => {
		expect(fitsPrinter(dots(48, 30), 'top', MODELS.b1).fits).toBe(true);
	});

	test('rotating the same label makes it fit, because 30 mm crosses instead', () => {
		expect(fitsPrinter(dots(50, 30), 'left', MODELS.b1).fits).toBe(true);
	});

	test('50 mm fits the Y50P exactly, at its limit', () => {
		expect(fitsPrinter(dots(50, 30), 'top', MODELS.y50p).fits).toBe(true);
		expect(fitsPrinter(dots(51, 30), 'top', MODELS.y50p).fits).toBe(false);
	});

	test('height is unbounded — the printer takes rows until the raster ends', () => {
		expect(fitsPrinter(dots(48, 200), 'top', MODELS.b1).fits).toBe(true);
	});
});

describe('media presets', () => {
	test('every printer has presets it can actually take', () => {
		for (const m of MODEL_LIST) {
			const usable = MEDIA_PRESETS.filter((p) => fitsPrinter(dots(p.wMm, p.hMm), 'top', m).fits);
			expect(usable.length).toBeGreaterThan(0);
		}
	});

	test('no preset is wider than the widest head', () => {
		for (const p of MEDIA_PRESETS)
			expect(p.wMm * DOTS_PER_MM).toBeLessThanOrEqual(MAX_PRINTHEAD_DOTS);
	});
});

describe('template defaults', () => {
	test('a blank template targets the Y50P, feeding top-first', () => {
		const t = TemplateSchema.parse({ id: 'x' });
		expect(t.printer).toBe('y50p');
		expect(t.printDirection).toBe('top');
		expect(fitsPrinter(t, t.printDirection, MODELS[t.printer]).fits).toBe(true);
	});

	test('a template saved before printers existed still loads', () => {
		// the autosave key is unversioned, so yesterday's template must survive
		const legacy = { id: 'x', version: 1, name: 'Old', width: 400, height: 240, elements: [] };
		const parsed = TemplateSchema.safeParse(legacy);
		expect(parsed.success).toBe(true);
		expect(parsed.data?.printer).toBe('y50p');
		expect(parsed.data?.printDirection).toBe('top');
	});
});
