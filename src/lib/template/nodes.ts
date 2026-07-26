import type Konva from 'konva';
import {
	fontStack,
	MIN_FONT_SIZE,
	type AnyElement,
	type BarcodeElement,
	type IconElement,
	type ImageElement
} from './schema';
import { THRESHOLD, lumaOverWhite } from '@slastra/yplib';
import { barcodeCanvas } from './barcode';
import { iconSvg, loadIcons, svgDataUrl } from './icons';
import { interpolate } from './vars';

export type KonvaNS = (typeof import('konva'))['default'];

export const LINE_HEIGHT = 1.15;

// The threshold and the luma formula come from yplib, so this app and the wire
// rasterizer cannot drift apart. A second copy is exactly how a preview and
// the paper start disagreeing.
export { THRESHOLD, lumaOverWhite };

/** Drop the oldest entries once a cache outgrows its cap. */
function evict(cache: Map<string, unknown>, cap: number) {
	while (cache.size > cap) {
		const oldest = cache.keys().next().value;
		if (oldest === undefined) return;
		cache.delete(oldest);
	}
}

/**
 * A bundled face isn't fetched until something asks for it, and
 * `document.fonts.ready` only waits on loads already in flight — so the first
 * render using a new face would silently fall back. Request it explicitly and
 * remember the promise.
 */
const fontLoads = new Map<string, Promise<unknown>>();
function ensureFont(stack: string): Promise<unknown> {
	let p = fontLoads.get(stack);
	if (!p) {
		// any size works; the load is per family, not per size
		p = document.fonts.load(`16px ${stack}`).catch(() => undefined);
		fontLoads.set(stack, p);
	}
	return p;
}

const barcodeCache = new Map<string, HTMLCanvasElement>();

const imageCache = new Map<string, Promise<HTMLImageElement>>();
export function loadImage(src: string): Promise<HTMLImageElement> {
	let p = imageCache.get(src);
	if (!p) {
		p = new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = () => reject(new Error('image failed to decode'));
			img.src = src;
		});
		imageCache.set(src, p);
		evict(imageCache, 16);
	}
	return p;
}

/**
 * Atkinson dithering, in place. Chosen over Floyd–Steinberg for thermal
 * printing: it diffuses only 6/8 of the error, which keeps midtones lighter
 * and edges cleaner on a printer that can't do gray at all.
 */
export function ditherAtkinson(cv: HTMLCanvasElement): HTMLCanvasElement {
	const ctx = cv.getContext('2d', { willReadFrequently: true });
	if (!ctx) return cv;
	const img = ctx.getImageData(0, 0, cv.width, cv.height);
	const { data, width, height } = img;
	const gray = new Float32Array(width * height);
	for (let i = 0; i < gray.length; i++) gray[i] = lumaOverWhite(data, i * 4);
	const spread: [number, number][] = [
		[1, 0],
		[2, 0],
		[-1, 1],
		[0, 1],
		[1, 1],
		[0, 2]
	];
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = y * width + x;
			const out = gray[i] < 128 ? 0 : 255;
			const err = (gray[i] - out) / 8;
			gray[i] = out;
			for (const [dx, dy] of spread) {
				const nx = x + dx,
					ny = y + dy;
				if (nx >= 0 && nx < width && ny < height) gray[ny * width + nx] += err;
			}
			const j = i * 4;
			data[j] = data[j + 1] = data[j + 2] = 0;
			data[j + 3] = out === 0 ? 255 : 0;
		}
	}
	ctx.putImageData(img, 0, 0);
	return cv;
}

/**
 * Konva filter reproducing the printer's 1-bit threshold on a node's cached
 * raster: dots that would print go opaque black, everything else goes fully
 * transparent so the white label shows through. Applied to nodes cached at
 * pixelRatio 1, this makes the editor render at exactly 8 dots/mm — what you
 * see per pixel is what the head burns.
 */
export function onebitFilter(imageData: ImageData) {
	const d = imageData.data;
	for (let i = 0; i < d.length; i += 4) {
		const black = lumaOverWhite(d, i) < THRESHOLD;
		d[i] = d[i + 1] = d[i + 2] = 0;
		d[i + 3] = black ? 255 : 0;
	}
}

/**
 * Reduce a canvas to printed dots: black where the head fires, transparent
 * everywhere else. Transparent (rather than white) lets the label's stock
 * colour show through in the editor; the print path composites over white, so
 * the raster is unchanged.
 */
export function thresholdCanvas(cv: HTMLCanvasElement, cutoff = THRESHOLD): HTMLCanvasElement {
	const ctx = cv.getContext('2d', { willReadFrequently: true });
	if (!ctx) return cv;
	const img = ctx.getImageData(0, 0, cv.width, cv.height);
	const { data } = img;
	for (let i = 0; i < data.length; i += 4) {
		const black = lumaOverWhite(data, i) < cutoff;
		data[i] = data[i + 1] = data[i + 2] = 0;
		data[i + 3] = black ? 255 : 0;
	}
	ctx.putImageData(img, 0, 0);
	return cv;
}

// Baked 1-bit canvases, keyed by conversion + placed size + source so two
// elements sharing one image at different sizes don't evict each other.
const bakedImages = new Map<string, HTMLCanvasElement>();

async function imageSource(el: ImageElement): Promise<CanvasImageSource> {
	const key = `${el.mode}|${el.w}x${el.h}|${el.dataUrl}`;
	const hit = bakedImages.get(key);
	if (hit) return hit;
	const img = await loadImage(el.dataUrl);
	// Bake the 1-bit conversion at the placed size so the editor shows the
	// exact dot pattern that prints — converting after scaling would differ.
	const cv = document.createElement('canvas');
	cv.width = el.w;
	cv.height = el.h;
	cv.getContext('2d')?.drawImage(img, 0, 0, el.w, el.h);
	if (el.mode === 'dither') ditherAtkinson(cv);
	else thresholdCanvas(cv);
	bakedImages.set(key, cv);
	evict(bakedImages, 32);
	return cv;
}

// Baked icons, keyed by everything that changes the pixels.
const bakedIcons = new Map<string, HTMLCanvasElement>();

/**
 * Rasterize a lucide icon to 1-bit at its placed size. Stroke geometry is the
 * best case for this printer — no dithering needed, just a clean threshold.
 */
async function iconSource(el: IconElement): Promise<CanvasImageSource> {
	const key = `${el.name}|${el.strokeWidth}|${el.w}x${el.h}`;
	const hit = bakedIcons.get(key);
	if (hit) return hit;
	const entry = (await loadIcons()).find((i) => i.name === el.name);
	if (!entry) throw new Error(`unknown icon: ${el.name}`);
	// square source at the larger edge keeps the glyph's aspect; the node then
	// draws it into the element box
	const size = Math.max(el.w, el.h);
	const img = await loadImage(svgDataUrl(iconSvg(entry.svg, el.strokeWidth, size)));
	const cv = document.createElement('canvas');
	cv.width = el.w;
	cv.height = el.h;
	cv.getContext('2d')?.drawImage(img, 0, 0, el.w, el.h);
	thresholdCanvas(cv);
	bakedIcons.set(key, cv);
	evict(bakedIcons, 32);
	return cv;
}

const TWO_D = new Set<string>(['qrcode', 'datamatrix']);

/**
 * Fit a scale-1 bwip render into the element's box with the module grid on an
 * integer dot multiple, centered in quiet-zone padding. Fractional module
 * widths are what make scaled barcodes both blurry on screen and marginal
 * under a scanner; snapping to whole dots fixes both. Bars of a 1D code are
 * uniform down each column, so stretching those to the box height is exact.
 */
export function fitBarcode(base: HTMLCanvasElement, el: BarcodeElement): HTMLCanvasElement {
	const cv = document.createElement('canvas');
	cv.width = el.w;
	cv.height = el.h;
	const ctx = cv.getContext('2d');
	if (!ctx) return base;
	// no white plate: the stock colour shows through the quiet zone
	ctx.imageSmoothingEnabled = false;
	const sx = Math.max(1, Math.floor(el.w / base.width));
	if (TWO_D.has(el.bcid)) {
		// uniform integer scale — 2D modules must stay square
		const s = Math.max(1, Math.min(sx, Math.floor(el.h / base.height)));
		const w = base.width * s,
			h = base.height * s;
		ctx.drawImage(base, Math.floor((el.w - w) / 2), Math.floor((el.h - h) / 2), w, h);
	} else {
		const w = base.width * sx;
		ctx.drawImage(base, Math.floor((el.w - w) / 2), 0, w, el.h);
	}
	return thresholdCanvas(cv);
}

/**
 * Build the Konva node for an element. The editor calls this with empty
 * values (placeholders stay visible); the print path passes a CSV row. Both
 * render through the same code so preview and paper cannot diverge.
 *
 * Throws if barcode data is invalid for the symbology.
 */
export async function buildNode(
	K: KonvaNS,
	el: AnyElement,
	values: Record<string, string | undefined>
): Promise<Konva.Shape> {
	// Every bake below emits black-on-transparent, so a node's alpha already IS
	// its ink mask. Feeding that mask to destination-out subtracts exactly the
	// shape from whatever was drawn beneath, which is the only way a light
	// mark can exist on a printer that owns one colour. It composites against earlier
	// siblings only, so z-order is what decides which rectangle a knockout
	// punches through.
	const common = {
		id: el.id,
		x: el.x,
		y: el.y,
		rotation: el.rotation,
		globalCompositeOperation: (el.ink === 'clear'
			? 'destination-out'
			: 'source-over') as GlobalCompositeOperation
	};
	switch (el.type) {
		case 'text': {
			// measure and wrap against the real face, never a fallback
			const family = fontStack(el.font);
			await ensureFont(family);
			const node = new K.Text({
				...common,
				width: el.w,
				text: interpolate(el.text, values),
				fontSize: el.fontSize,
				fontStyle: [el.italic && 'italic', el.bold && 'bold'].filter(Boolean).join(' ') || 'normal',
				textDecoration: el.underline ? 'underline' : '',
				fontFamily: family,
				align: el.align,
				// takes effect only once height is pinned below; during the
				// autoFit measurement height is unset, so this cannot skew it
				verticalAlign: el.verticalAlign,
				wrap: 'word',
				lineHeight: LINE_HEIGHT,
				fill: '#000'
			});
			if (el.autoFit) {
				// While height is unset, node.height() measures the wrapped content.
				// Binary search — each fontSize() call re-runs Konva's wrapping, so
				// a linear walk from 200 would cost ~190 layout passes per rebuild.
				// +1 absorbs the rounding between a transform gesture's stored box
				// height and the re-rendered text height — without it, resizing can
				// nudge the font down a step it doesn't need.
				const fits = (size: number) => {
					node.fontSize(size);
					return node.height() <= el.h + 1;
				};
				if (!fits(el.fontSize)) {
					let lo = MIN_FONT_SIZE,
						hi = el.fontSize;
					while (lo < hi) {
						const mid = Math.ceil((lo + hi) / 2);
						if (fits(mid)) lo = mid;
						else hi = mid - 1;
					}
					node.fontSize(lo);
				}
			}
			// Then pin the box to the model: the transformer frames the box the
			// user drew, and with autoFit off Konva truncates overflow at the box
			// edge instead of spilling past it.
			node.height(el.h);
			return rasterizeAtDots(node);
		}
		case 'barcode': {
			// Editor keystrokes rebuild every node; cache the scale-1 bwip
			// render so it only re-runs when the resolved data changes. The
			// cheap fit-to-box pass runs every rebuild, so resizing re-snaps
			// the module grid instead of scaling stale pixels.
			const resolved = interpolate(el.data, values);
			const key = `${el.bcid}|${resolved}`;
			let base = barcodeCache.get(key);
			if (!base) {
				base = await barcodeCanvas(el, resolved);
				barcodeCache.set(key, base);
				// typing into a bound CSV column churns keys; keep the cache small
				evict(barcodeCache, 64);
			}
			const img = new K.Image({
				...common,
				image: fitBarcode(base, el),
				width: el.w,
				height: el.h
			});
			// the editor re-fits from this during resize gestures so bars
			// re-snap live instead of stretching
			img.setAttr('barcodeBase', base);
			return img;
		}
		case 'image':
			return new K.Image({ ...common, image: await imageSource(el), width: el.w, height: el.h });
		case 'icon':
			return new K.Image({ ...common, image: await iconSource(el), width: el.w, height: el.h });
		case 'rect': {
			// dash lengths scale with thickness so heavier borders keep the
			// same visual rhythm at 1-bit
			const dash =
				el.borderStyle === 'dashed'
					? [el.thickness * 3, el.thickness * 2]
					: el.borderStyle === 'dotted'
						? [el.thickness, el.thickness * 1.5]
						: undefined;
			return rasterizeAtDots(
				new K.Rect({
					...common,
					width: el.w,
					height: el.h,
					cornerRadius: el.radius,
					fill: el.solid ? '#000' : undefined,
					stroke: el.solid ? undefined : '#000',
					strokeWidth: el.thickness,
					dash: el.solid ? undefined : dash,
					// stroke thickness is label geometry, not a UI affordance — it
					// must not change when the editor scales the node mid-gesture
					strokeScaleEnabled: false
				})
			);
		}
	}
}

/**
 * Cache a vector node at 1 unit = 1 printer dot and threshold it to 1-bit, so
 * text and strokes preview (and print) at the head's real 203 dpi resolution.
 * Hit detection is unaffected: Konva builds the hit canvas from hitFunc, not
 * the filtered scene, so a text box stays clickable across its whole area.
 */
function rasterizeAtDots(node: Konva.Shape): Konva.Shape {
	node.cache({ pixelRatio: 1 });
	node.filters([onebitFilter]);
	return node;
}
