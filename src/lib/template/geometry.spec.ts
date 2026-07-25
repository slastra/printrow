import { describe, expect, test } from 'bun:test';
import { alignTargets, distributeTargets, elementAABB, selectionBounds } from './geometry';
import { ElementSchema, type AnyElement } from './schema';

function rect(id: string, x: number, y: number, w: number, h: number, rotation = 0): AnyElement {
	return ElementSchema.parse({ id, type: 'rect', x, y, w, h, rotation });
}

describe('elementAABB', () => {
	test('unrotated is the element box', () => {
		expect(elementAABB(rect('a', 10, 20, 40, 30))).toEqual({ x: 10, y: 20, w: 40, h: 30 });
	});

	test('90° rotation about top-left swings the box left', () => {
		// corners land at x ∈ [-30, 0], y ∈ [0, 40] relative to the origin
		const bb = elementAABB(rect('a', 100, 50, 40, 30, 90));
		expect(bb.x).toBeCloseTo(70);
		expect(bb.y).toBeCloseTo(50);
		expect(bb.w).toBeCloseTo(30);
		expect(bb.h).toBeCloseTo(40);
	});

	test('180° keeps dimensions, mirrors position', () => {
		const bb = elementAABB(rect('a', 0, 0, 40, 30, 180));
		expect(bb.x).toBeCloseTo(-40);
		expect(bb.y).toBeCloseTo(-30);
		expect(bb.w).toBeCloseTo(40);
		expect(bb.h).toBeCloseTo(30);
	});
});

describe('alignTargets', () => {
	const bounds = { x: 0, y: 0, w: 400, h: 240 };

	test('aligns AABBs, not raw x/y, for rotated elements', () => {
		const el = rect('a', 100, 50, 40, 30, 90); // AABB starts 30 left of x
		const [t] = alignTargets('left', [el], bounds);
		// AABB.x must land at 0 → x moves to 30
		expect(t.x).toBe(30);
		expect(t.y).toBe(50);
	});

	test('center and right', () => {
		const el = rect('a', 0, 0, 100, 40);
		expect(alignTargets('centerX', [el], bounds)[0].x).toBe(150);
		expect(alignTargets('right', [el], bounds)[0].x).toBe(300);
		expect(alignTargets('bottom', [el], bounds)[0].y).toBe(200);
	});
});

describe('distributeTargets', () => {
	test('equal gaps, outermost fixed', () => {
		const els = [rect('a', 0, 0, 20, 20), rect('b', 30, 0, 20, 20), rect('c', 100, 0, 20, 20)];
		const targets = distributeTargets('x', els);
		const byId = Object.fromEntries(targets.map((t) => [t.id, t]));
		expect(byId.a.x).toBe(0);
		expect(byId.b.x).toBe(50); // gap = (120 - 60) / 2 = 30 → 0+20+30
		expect(byId.c.x).toBe(100);
	});

	test('needs three elements', () => {
		expect(distributeTargets('x', [rect('a', 0, 0, 10, 10), rect('b', 50, 0, 10, 10)])).toEqual([]);
	});
});

describe('selectionBounds', () => {
	test('union of AABBs', () => {
		expect(selectionBounds([rect('a', 0, 0, 10, 10), rect('b', 50, 40, 20, 20)])).toEqual({
			x: 0,
			y: 0,
			w: 70,
			h: 60
		});
	});
});
