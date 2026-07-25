import type { Component } from 'svelte';
import TypeIcon from '@lucide/svelte/icons/type';
import BarcodeIcon from '@lucide/svelte/icons/barcode';
import ImageIcon from '@lucide/svelte/icons/image';
import SquareIcon from '@lucide/svelte/icons/square';
import ShapesIcon from '@lucide/svelte/icons/shapes';
import type { AnyElement } from './schema';

export type ElementKind = AnyElement['type'];

interface ElementMeta {
	/** Display name in the insert bar and as the layers-panel fallback. */
	name: string;
	icon: Component;
	/** Insert-time defaults, merged over id/x/y by editor.add(). */
	defaults: Record<string, unknown>;
	/** Layers-panel row label, when the element has no authored content. */
	label?: (el: AnyElement) => string;
	/** The user-authored string to show verbatim (with {{vars}} highlighted), if any. */
	content?: (el: AnyElement) => string;
	/** Single-axis handle drags reflow content (text re-wraps, barcode
	 * re-snaps its module grid) instead of stretching it. */
	reflowsOnAxisResize: boolean;
	/** Corner drags scale the type itself rather than just the box. */
	cornerScalesFont: boolean;
	/** Corner drags preserve aspect ratio. */
	keepAspect: boolean;
}

/**
 * Everything the UI needs to know per element type, in one place — the insert
 * bar, layers panel, editor defaults, and canvas gesture semantics all consume
 * this table, so a new element type is one entry here plus its buildNode case.
 */
export const ELEMENT_META: Record<ElementKind, ElementMeta> = {
	text: {
		name: 'Text',
		icon: TypeIcon,
		defaults: { type: 'text', text: 'New text', w: 180, h: 44 },
		content: (el) => (el.type === 'text' ? el.text.replace(/\s+/g, ' ').trim() : ''),
		reflowsOnAxisResize: true,
		cornerScalesFont: true,
		keepAspect: true
	},
	barcode: {
		name: 'Barcode',
		icon: BarcodeIcon,
		defaults: { type: 'barcode', data: '{{code}}', w: 200, h: 80 },
		content: (el) => (el.type === 'barcode' ? el.data : ''),
		reflowsOnAxisResize: true,
		cornerScalesFont: false,
		keepAspect: true
	},
	image: {
		name: 'Image',
		icon: ImageIcon,
		defaults: { type: 'image' },
		reflowsOnAxisResize: false,
		cornerScalesFont: false,
		keepAspect: true
	},
	icon: {
		name: 'Icon',
		icon: ShapesIcon,
		defaults: { type: 'icon', name: 'star', w: 96, h: 96 },
		label: (el) => (el.type === 'icon' ? el.name : 'Icon'),
		reflowsOnAxisResize: false,
		cornerScalesFont: false,
		keepAspect: true
	},
	rect: {
		name: 'Box',
		icon: SquareIcon,
		defaults: { type: 'rect', w: 120, h: 80 },
		label: (el) => (el.type === 'rect' && el.solid ? 'Box (solid)' : 'Box'),
		reflowsOnAxisResize: false,
		cornerScalesFont: false,
		keepAspect: false
	}
};
