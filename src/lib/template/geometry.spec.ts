import { describe, expect, test } from 'bun:test';
import {
	alignTargets,
	arrangeUnits,
	distributeTargets,
	elementAABB,
	selectionBounds
} from './geometry';
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

describe('grouping', () => {
	// two elements offset by (40, 30), banded into one group
	const pair = (gid: string) => [
		{ ...rect('a', 100, 0, 20, 20), groupId: gid },
		{ ...rect('b', 140, 30, 20, 20), groupId: gid }
	];

	test('a group is one unit; loose elements are one each', () => {
		const els = [...pair('g'), rect('c', 0, 0, 10, 10)];
		expect(arrangeUnits(els).length).toBe(2);
	});

	test("a unit's box is the union of its members", () => {
		expect(arrangeUnits(pair('g'))[0].box).toEqual({ x: 100, y: 0, w: 60, h: 50 });
	});

	test('aligning moves a group as one object, preserving its layout', () => {
		const els = pair('g');
		const targets = alignTargets('left', els, { x: 0, y: 0, w: 400, h: 240 });
		const byId = Object.fromEntries(targets.map((t) => [t.id, t]));
		// the group's left edge (100) lands on 0, so both members shift by -100
		expect(byId.a).toEqual({ id: 'a', x: 0, y: 0 });
		expect(byId.b).toEqual({ id: 'b', x: 40, y: 30 });
		// the relative offset that made it a group survives
		expect(byId.b.x - byId.a.x).toBe(40);
		expect(byId.b.y - byId.a.y).toBe(30);
	});

	test('a group aligns against a loose element as a single box', () => {
		const loose = rect('c', 300, 0, 20, 20);
		const els = [...pair('g'), loose];
		const byId = Object.fromEntries(
			alignTargets('right', els, selectionBounds(els)).map((t) => [t.id, t])
		);
		// selection right edge is 320; the group's right edge (160) moves there,
		// shifting both members by +160. The loose element is already there.
		expect(byId.a.x).toBe(260);
		expect(byId.b.x).toBe(300);
		expect(byId.c.x).toBe(300);
	});

	test('distribute counts units, so one group of three has nothing to spread', () => {
		const els = [
			{ ...rect('a', 0, 0, 20, 20), groupId: 'g' },
			{ ...rect('b', 30, 0, 20, 20), groupId: 'g' },
			{ ...rect('c', 100, 0, 20, 20), groupId: 'g' }
		];
		expect(distributeTargets('x', els)).toEqual([]);
	});

	test('distribute spaces a group as one item and keeps it intact', () => {
		const els = [
			rect('a', 0, 0, 20, 20),
			{ ...rect('g1', 40, 0, 20, 20), groupId: 'g' },
			{ ...rect('g2', 70, 0, 20, 20), groupId: 'g' }, // group box: x 40..90, w 50
			rect('z', 200, 0, 20, 20)
		];
		const byId = Object.fromEntries(distributeTargets('x', els).map((t) => [t.id, t]));
		// span 220, sizes 20+50+20=90, gap = (220-90)/2 = 65
		// a stays at 0; group starts at 20+65 = 85; z ends fixed at 200
		expect(byId.a.x).toBe(0);
		expect(byId.g1.x).toBe(85);
		expect(byId.g2.x).toBe(115); // internal 30px offset preserved
		expect(byId.z.x).toBe(200);
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
