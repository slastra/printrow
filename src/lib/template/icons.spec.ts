import { describe, expect, test } from 'bun:test';
import { iconSvg, searchIcons, svgDataUrl, type IconEntry } from './icons';

const index: IconEntry[] = [
	{ name: 'triangle-alert', tags: ['warning', 'danger', 'alert'], svg: '<svg/>' },
	{ name: 'alert-circle', tags: ['warning', 'alert'], svg: '<svg/>' },
	{ name: 'star', tags: ['favorite', 'bookmark'], svg: '<svg/>' },
	{ name: 'star-half', tags: ['favorite'], svg: '<svg/>' },
	{ name: 'recycle', tags: ['environment', 'sustainability'], svg: '<svg/>' }
];

describe('searchIcons', () => {
	test('finds by tag, which plain name matching would miss', () => {
		const names = searchIcons(index, 'warning').map((e) => e.name);
		expect(names).toContain('triangle-alert');
		expect(names).toContain('alert-circle');
		expect(names).not.toContain('star');
	});

	test('ranks exact name, then prefix, then exact tag, then substring', () => {
		expect(searchIcons(index, 'star').map((e) => e.name)).toEqual(['star', 'star-half']);
		// 'alert' is a name prefix for alert-circle and a substring of triangle-alert
		expect(searchIcons(index, 'alert')[0].name).toBe('alert-circle');
	});

	test('an exact keyword outranks a name substring', () => {
		// the case that matters: searching "warning" must surface icons tagged
		// as warnings above every icon that merely has "warning" in its name
		const withNoise: IconEntry[] = [
			{ name: 'battery-warning', tags: ['power'], svg: '<svg/>' },
			{ name: 'mail-warning', tags: ['email'], svg: '<svg/>' },
			...index
		];
		const names = searchIcons(withNoise, 'warning').map((e) => e.name);
		expect(names.indexOf('triangle-alert')).toBeLessThan(names.indexOf('battery-warning'));
		expect(names.indexOf('alert-circle')).toBeLessThan(names.indexOf('mail-warning'));
	});

	test('empty query lists the set, and results are capped', () => {
		expect(searchIcons(index, '').length).toBe(index.length);
		expect(searchIcons(index, '', 2).length).toBe(2);
		expect(searchIcons(index, 'a', 1).length).toBe(1);
	});

	test('no match yields nothing', () => {
		expect(searchIcons(index, 'zzzz')).toEqual([]);
	});
});

describe('iconSvg', () => {
	const raw =
		'<svg width="24" height="24" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M0 0"/></svg>';

	test('sets size and stroke weight in viewBox units', () => {
		const out = iconSvg(raw, 3, 96);
		expect(out).toContain('width="96"');
		expect(out).toContain('height="96"');
		expect(out).toContain('stroke-width="3"');
		// the viewBox must be untouched, or the geometry rescales
		expect(out).toContain('viewBox="0 0 24 24"');
	});

	test('forces black by default, since currentColor has no meaning on the raster', () => {
		expect(iconSvg(raw, 2, 48)).toContain('stroke="#000000"');
	});

	test('keeps currentColor for UI previews so they follow the theme', () => {
		expect(iconSvg(raw, 2, 20, 'currentColor')).toContain('stroke="currentColor"');
	});
});

describe('svgDataUrl', () => {
	test('encodes markup safely for an <img> source', () => {
		const url = svgDataUrl('<svg stroke="#000"><path d="M0 0"/></svg>');
		expect(url.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
		expect(url).not.toContain('#000"'); // encoded, not raw
		expect(decodeURIComponent(url.split(',')[1])).toContain('<path d="M0 0"/>');
	});
});
