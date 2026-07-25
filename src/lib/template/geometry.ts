import type { AnyElement } from './schema';

export interface Box {
	x: number;
	y: number;
	w: number;
	h: number;
}

export type AlignKind = 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom';

/**
 * Axis-aligned bounds of an element as drawn. Rotation is about the element's
 * top-left origin (x, y), matching how Konva positions our nodes.
 */
export function elementAABB(el: AnyElement): Box {
	const rad = (el.rotation * Math.PI) / 180;
	const cos = Math.cos(rad),
		sin = Math.sin(rad);
	const xs = [0, el.w * cos, -el.h * sin, el.w * cos - el.h * sin];
	const ys = [0, el.w * sin, el.h * cos, el.w * sin + el.h * cos];
	const minX = Math.min(...xs),
		minY = Math.min(...ys);
	return {
		x: el.x + minX,
		y: el.y + minY,
		w: Math.max(...xs) - minX,
		h: Math.max(...ys) - minY
	};
}

export function selectionBounds(els: AnyElement[]): Box {
	const boxes = els.map(elementAABB);
	const x = Math.min(...boxes.map((b) => b.x)),
		y = Math.min(...boxes.map((b) => b.y));
	return {
		x,
		y,
		w: Math.max(...boxes.map((b) => b.x + b.w)) - x,
		h: Math.max(...boxes.map((b) => b.y + b.h)) - y
	};
}

/** New positions that align each element's AABB inside `bounds`. */
export function alignTargets(
	kind: AlignKind,
	els: AnyElement[],
	bounds: Box
): { id: string; x: number; y: number }[] {
	return els.map((el) => {
		const bb = elementAABB(el);
		let dx = 0,
			dy = 0;
		switch (kind) {
			case 'left':
				dx = bounds.x - bb.x;
				break;
			case 'centerX':
				dx = bounds.x + bounds.w / 2 - (bb.x + bb.w / 2);
				break;
			case 'right':
				dx = bounds.x + bounds.w - (bb.x + bb.w);
				break;
			case 'top':
				dy = bounds.y - bb.y;
				break;
			case 'centerY':
				dy = bounds.y + bounds.h / 2 - (bb.y + bb.h / 2);
				break;
			case 'bottom':
				dy = bounds.y + bounds.h - (bb.y + bb.h);
				break;
		}
		return { id: el.id, x: Math.round(el.x + dx), y: Math.round(el.y + dy) };
	});
}

/**
 * Even gaps along one axis. Outermost elements stay fixed; the others spread
 * between them. Standard design-tool semantics; needs 3+ elements.
 */
export function distributeTargets(
	axis: 'x' | 'y',
	els: AnyElement[]
): { id: string; x: number; y: number }[] {
	if (els.length < 3) return [];
	const size = (b: Box) => (axis === 'x' ? b.w : b.h);
	const pos = (b: Box) => (axis === 'x' ? b.x : b.y);
	const items = els
		.map((el) => ({ el, bb: elementAABB(el) }))
		.sort((a, b) => pos(a.bb) - pos(b.bb));
	const first = items[0],
		last = items[items.length - 1];
	const span = pos(last.bb) + size(last.bb) - pos(first.bb);
	const total = items.reduce((n, i) => n + size(i.bb), 0);
	const gap = (span - total) / (items.length - 1);
	let cursor = pos(first.bb);
	return items.map(({ el, bb }) => {
		const d = cursor - pos(bb);
		cursor += size(bb) + gap;
		return {
			id: el.id,
			x: Math.round(el.x + (axis === 'x' ? d : 0)),
			y: Math.round(el.y + (axis === 'y' ? d : 0))
		};
	});
}
