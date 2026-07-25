import type Konva from 'konva';
import {
	DEFAULT_FONT,
	MIN_FONT_SIZE,
	type AnyElement,
	type BarcodeElement,
	type ImageElement
} from './schema';
import { barcodeCanvas } from './barcode';
import { interpolate } from './vars';

export type KonvaNS = (typeof import('konva'))['default'];

export const LINE_HEIGHT = 1.15;

/** 1-bit cutoff — matches the hardware-verified Python renderer. */
export const THRESHOLD = 128;

/**
 * BT.601 luma composited over white paper — THE print-fidelity formula. Every
 * 1-bit conversion (dither, threshold, node filter, wire rasterizer) must use
 * this one function or preview and paper can silently desync.
 */
export function lumaOverWhite(data: Uint8ClampedArray, i: number): number {
	const a = data[i + 3] / 255;
	return (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) * a + 255 * (1 - a);
}

/** Drop the oldest entries once a cache outgrows its cap. */
function evict(cache: Map<string, unknown>, cap: number) {
	while (cache.size > cap) {
		const oldest = cache.keys().next().value;
		if (oldest === undefined) return;
		cache.delete(oldest);
	}
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
			data[j] = data[j + 1] = data[j + 2] = out;
			data[j + 3] = 255;
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

/** Hard 1-bit threshold, in place — same luma + white compositing as the print path. */
export function thresholdCanvas(cv: HTMLCanvasElement, cutoff = THRESHOLD): HTMLCanvasElement {
	const ctx = cv.getContext('2d', { willReadFrequently: true });
	if (!ctx) return cv;
	const img = ctx.getImageData(0, 0, cv.width, cv.height);
	const { data } = img;
	for (let i = 0; i < data.length; i += 4) {
		const out = lumaOverWhite(data, i) < cutoff ? 0 : 255;
		data[i] = data[i + 1] = data[i + 2] = out;
		data[i + 3] = 255;
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
	ctx.fillStyle = '#fff';
	ctx.fillRect(0, 0, el.w, el.h);
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
	return cv;
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
	const common = { id: el.id, x: el.x, y: el.y, rotation: el.rotation };
	switch (el.type) {
		case 'text': {
			const node = new K.Text({
				...common,
				width: el.w,
				text: interpolate(el.text, values),
				fontSize: el.fontSize,
				fontStyle: [el.italic && 'italic', el.bold && 'bold'].filter(Boolean).join(' ') || 'normal',
				textDecoration: el.underline ? 'underline' : '',
				fontFamily: DEFAULT_FONT,
				align: el.align,
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
		case 'rect':
			return rasterizeAtDots(
				new K.Rect({
					...common,
					width: el.w,
					height: el.h,
					fill: el.solid ? '#000' : undefined,
					stroke: el.solid ? undefined : '#000',
					strokeWidth: el.thickness,
					// stroke thickness is label geometry, not a UI affordance — it
					// must not change when the editor scales the node mid-gesture
					strokeScaleEnabled: false
				})
			);
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
