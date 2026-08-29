import { z } from 'zod';
import { HEIGHT, THRESHOLD } from '@slastra/yplib';
import { MAX_PRINTHEAD_DOTS, MODELS, type PrinterId } from '$lib/printer/models';

// All geometry is in printer dots — the editor stage, print renderer, and wire
// format share one coordinate space, with zoom applied only at display time.
// Both supported printers run at 8 dots/mm, so one grid serves both.
//
// The SCHEMA's width bound is the widest head of any supported model; the
// selected printer's own, narrower bound is enforced by the media picker and
// again at print time. Storing the looser bound means switching a template
// from the 50 mm printer to the 48 mm one flags it rather than discarding it.
export const DOTS_PER_MM = 8;
export const LABEL_W = MODELS.y50p.printheadDots;
export const LABEL_H = HEIGHT;

// Shared bounds: the zod schema and every gesture/mutation clamp must agree,
// or clamped-in-view values can produce elements the schema later rejects.
export const MIN_SIZE = 8;
export const MIN_FONT_SIZE = 6;
export const MAX_FONT_SIZE = 200;

export const BORDER_STYLES = ['solid', 'dashed', 'dotted'] as const;

/** Burn ink, or knock it back out of whatever sits behind. */
export const INKS = ['black', 'clear'] as const;
export type Ink = (typeof INKS)[number];
export type BorderStyle = (typeof BORDER_STYLES)[number];

// Media bounds in mm, derived from the print heads so one model change
// propagates to the picker, the schema, and the clamps.
export const MEDIA_MIN_MM = 10;
export const MEDIA_MAX_W_MM = MAX_PRINTHEAD_DOTS / DOTS_PER_MM;
export const MEDIA_MAX_H_MM = 200;

/**
 * Thermal stock comes in colours, but the printer only burns black — so this
 * is a preview property. The print path always rasterizes against white.
 */
export const STOCK_COLORS = [
	{ value: '#ffffff', label: 'White' },
	{ value: '#fde68a', label: 'Yellow' },
	{ value: '#fca5a5', label: 'Red' },
	{ value: '#a5b4fc', label: 'Blue' },
	{ value: '#a7f3d0', label: 'Green' },
	{ value: '#fdba74', label: 'Orange' },
	{ value: '#f9a8d4', label: 'Pink' },
	{ value: '#e5e7eb', label: 'Silver' }
] as const;

// Icon stroke weight, in the 24-unit lucide viewBox.
export const MIN_STROKE = 1;
export const MAX_STROKE = 6;

// Box geometry bounds, shared by the schema and the inspector controls.
export const MIN_THICKNESS = 1;
export const MAX_THICKNESS = 50;
export const MAX_RADIUS = 120;

// Text metrics. Line height is a multiple of the font size, matching Konva;
// letter spacing is absolute dots, like every other geometry number here.
//
// Below about 0.6 the descenders of one line merge into the caps of the next
// once thresholded to 1-bit. Above 3 there is nothing left to gain: with
// shrink-to-fit on, more leading only shrinks the type, and with it off Konva
// starts dropping lines at the box edge instead.
export const MIN_LINE_HEIGHT = 0.5;
export const MAX_LINE_HEIGHT = 3;
export const DEFAULT_LINE_HEIGHT = 1.15;
// Negative tightens. It has to be allowed — every other element number here is
// non-negative, and a reflexive min of 0 would make each tightening edit vanish
// silently at the mutation funnel, which validates rather than clamps.
export const MIN_LETTER_SPACING = -10;
export const MAX_LETTER_SPACING = 40;

// Per-image 1-bit cutoff, in luma. Stops short of 0 and 255 because both ends
// are degenerate — nothing fires at all, or every pixel but pure white does —
// and they are the first places a slider gets dragged to.
export const MIN_CUTOFF = 16;
export const MAX_CUTOFF = 240;

// Height is safe to vary — both printers take rows until the raster ends.
// Width is capped by the selected printer's head, which is why the 48 mm
// entries exist alongside the 50 mm ones rather than replacing them.
export interface MediaPreset {
	label: string;
	wMm: number;
	hMm: number;
}
export const MEDIA_PRESETS: MediaPreset[] = [
	{ label: '50 × 30 mm', wMm: 50, hMm: 30 },
	{ label: '50 × 40 mm', wMm: 50, hMm: 40 },
	{ label: '50 × 50 mm', wMm: 50, hMm: 50 },
	{ label: '50 × 80 mm', wMm: 50, hMm: 80 },
	{ label: '48 × 30 mm', wMm: 48, hMm: 30 },
	{ label: '48 × 40 mm', wMm: 48, hMm: 40 },
	{ label: '48 × 50 mm', wMm: 48, hMm: 50 },
	{ label: '48 × 80 mm', wMm: 48, hMm: 80 },
	{ label: '40 × 30 mm', wMm: 40, hMm: 30 },
	{ label: '40 × 60 mm', wMm: 40, hMm: 60 },
	{ label: '30 × 20 mm', wMm: 30, hMm: 20 }
];

export const PRINTER_IDS = ['y50p', 'b1'] as const satisfies readonly PrinterId[];
export const PRINT_DIRECTIONS = ['top', 'left'] as const;

/**
 * How a text element decides its type size.
 *
 *  - `fixed`  — use the stored fontSize; Konva truncates at the box edge.
 *  - `shrink` — come DOWN from the stored size until the text fits. The stored
 *               size is a ceiling, so a long CSV value still lands inside.
 *  - `fill`   — size to the box in BOTH directions, so the box sets the size
 *               and the stored fontSize is inert.
 */
export const TEXT_SIZING = ['fixed', 'shrink', 'fill'] as const;
export type TextSizing = (typeof TEXT_SIZING)[number];

/**
 * Bundled faces, so every machine rasterizes text identically — a system font
 * would make the same template print differently per device. Chosen to stay
 * legible once thresholded to 1-bit at 8 dots/mm: no hairline weights, and a
 * condensed face because labels run out of width before they run out of room.
 *
 * Templates store the key, not the CSS stack, so the stack can change without
 * breaking saved work.
 */
export const FONTS = [
	{ key: 'inter', label: 'Inter', stack: "'Inter Variable', sans-serif" },
	// Pacifico over a finer script: thick strokes survive the 1-bit threshold
	{ key: 'script', label: 'Pacifico', stack: "'Pacifico', cursive" },
	{ key: 'oswald', label: 'Oswald', stack: "'Oswald Variable', sans-serif" },
	{ key: 'serif', label: 'Source Serif', stack: "'Source Serif 4 Variable', serif" },
	{ key: 'mono', label: 'JetBrains Mono', stack: "'JetBrains Mono Variable', monospace" },
	{ key: 'bebas', label: 'Bebas Neue', stack: "'Bebas Neue', sans-serif" },
	{ key: 'black', label: 'Archivo Black', stack: "'Archivo Black', sans-serif" },
	{ key: 'display', label: 'Playfair Display', stack: "'Playfair Display Variable', serif" },
	{ key: 'grotesk', label: 'Space Grotesk', stack: "'Space Grotesk Variable', sans-serif" }
] as const;
export type FontKey = (typeof FONTS)[number]['key'];
export const FONT_KEYS = FONTS.map((f) => f.key) as [FontKey, ...FontKey[]];

export function fontStack(key: FontKey): string {
	return (FONTS.find((f) => f.key === key) ?? FONTS[0]).stack;
}

export const DEFAULT_FONT = FONTS[0].stack;

export const BARCODE_TYPES = [
	'code128',
	'qrcode',
	'datamatrix',
	'code39',
	'ean13',
	'upca',
	'interleaved2of5'
] as const;
export type BarcodeType = (typeof BARCODE_TYPES)[number];

const base = {
	id: z.string(),
	x: z.number().int(),
	y: z.number().int(),
	w: z.number().int().min(MIN_SIZE),
	h: z.number().int().min(MIN_SIZE),
	// Degrees, free-form. Off-axis angles alias at 1-bit (especially barcode
	// bars) — the preview thresholds the same render, so what you see is the
	// honest result.
	rotation: z.number().min(0).max(360).default(0),
	// Elements sharing a groupId select and move as one (flat groups, no nesting).
	groupId: z.string().optional(),
	// The head can only burn or not burn, so there is no light-coloured ink: a
	// clear element KNOCKS OUT the ink behind it, letting the stock show
	// through. That is what makes text legible inside a solid rectangle, and
	// why it reads as the stock colour rather than white. Nothing behind it
	// means nothing to remove, so it prints as blank.
	ink: z.enum(INKS).default('black')
};

export const TextElementSchema = z
	.object({
		...base,
		type: z.literal('text'),
		// May contain {{var}} placeholders resolved from a CSV row at print time.
		text: z.string(),
		fontSize: z.number().int().min(MIN_FONT_SIZE).max(MAX_FONT_SIZE).default(32),
		font: z.enum(FONT_KEYS).default('inter'),
		bold: z.boolean().default(true),
		italic: z.boolean().default(false),
		underline: z.boolean().default(false),
		align: z.enum(['left', 'center', 'right']).default('left'),
		// Where the wrapped block sits inside the box. Only visible once the text
		// is shorter than its box, which is the usual case for a fixed-height
		// field fed from a CSV column.
		verticalAlign: z.enum(['top', 'middle', 'bottom']).default('top'),
		// See TEXT_SIZING. Optional so the transform below can tell "absent" from
		// "chosen" — the default lives there, not here.
		sizing: z.enum(TEXT_SIZING).optional(),
		/**
		 * @deprecated Superseded by `sizing`; read only by the migration below and
		 * stripped from the output, so it never reaches a saved template again.
		 */
		autoFit: z.boolean().optional(),
		// Leading, as a multiple of the font size. Tightening it is often what lets
		// a two-line field fit its box instead of the type shrinking.
		lineHeight: z.number().min(MIN_LINE_HEIGHT).max(MAX_LINE_HEIGHT).default(DEFAULT_LINE_HEIGHT),
		// Tracking, in dots. Whole dots only: a fractional advance moves nothing but
		// antialiasing, which the 1-bit pass then throws away. Condensed faces need
		// this most — their stems sit close enough to bridge under a hard threshold.
		letterSpacing: z.number().int().min(MIN_LETTER_SPACING).max(MAX_LETTER_SPACING).default(0)
	})
	.transform(({ autoFit, ...el }) => ({
		// Migrate the pre-`sizing` boolean and drop it, so a saved template never
		// carries both. This lives in the schema rather than at the autosave, so it
		// covers every path in — the loader, undo's re-parse, and the mutation
		// funnel alike. It has to be `.transform()` specifically: zod accepts that
		// as a discriminated-union member, but rejects `z.preprocess`.
		...el,
		sizing: el.sizing ?? (autoFit === false ? 'fixed' : 'shrink')
	}));

export const BarcodeElementSchema = z.object({
	...base,
	type: z.literal('barcode'),
	bcid: z.enum(BARCODE_TYPES).default('code128'),
	// May contain {{var}} placeholders.
	data: z.string()
});

export const ImageElementSchema = z.object({
	...base,
	type: z.literal('image'),
	// Embedded so a template document stays self-contained and exportable.
	dataUrl: z.string(),
	// threshold keeps logos/line art crisp; dither is for photos and gradients,
	// which a hard threshold annihilates.
	mode: z.enum(['threshold', 'dither']).default('threshold'),
	// The luma below which a pixel fires the head, so HIGHER lays down more ink.
	// Named cutoff rather than threshold because `mode` already owns that word
	// here and the two would read as related. Feeds both conversions: a hard
	// cutoff under threshold, the dither's own decision point under dither,
	// where it behaves as a darkness control.
	cutoff: z.number().int().min(MIN_CUTOFF).max(MAX_CUTOFF).default(THRESHOLD)
});

export const IconElementSchema = z.object({
	...base,
	type: z.literal('icon'),
	// kebab-case lucide id, e.g. "triangle-alert"
	name: z.string().min(1),
	strokeWidth: z.number().min(MIN_STROKE).max(MAX_STROKE).default(2)
});

export const RectElementSchema = z.object({
	...base,
	type: z.literal('rect'),
	solid: z.boolean().default(false),
	thickness: z.number().int().min(MIN_THICKNESS).max(MAX_THICKNESS).default(2),
	borderStyle: z.enum(BORDER_STYLES).default('solid'),
	// corner radius in dots; applies to fill and border alike
	radius: z.number().int().min(0).max(MAX_RADIUS).default(0)
});

export const ElementSchema = z.discriminatedUnion('type', [
	TextElementSchema,
	BarcodeElementSchema,
	ImageElementSchema,
	IconElementSchema,
	RectElementSchema
]);

/**
 * Per-column display formatting, applied wherever {{column}} is substituted.
 * Kept on the template (not the CSV) so the same formatting survives a
 * re-import of next week's data.
 */
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'MXN'] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Deterministic date patterns (no locale surprises between machines). */
export const DATE_PATTERNS = [
	{ value: 'iso', label: 'ISO', example: '2026-07-25' },
	{ value: 'us', label: 'US', example: '07/25/2026' },
	{ value: 'eu', label: 'European', example: '25/07/2026' },
	{ value: 'medium', label: 'Medium', example: 'Jul 25, 2026' },
	{ value: 'long', label: 'Long', example: 'July 25, 2026' },
	{ value: 'day-month', label: 'Day month', example: '25 Jul 2026' },
	{ value: 'compact', label: 'Compact', example: '25Jul26' }
] as const;
export type DatePattern = (typeof DATE_PATTERNS)[number]['value'];

export const ColumnFormatSchema = z.object({
	// which family of options applies; text is the pass-through default
	kind: z.enum(['text', 'number', 'currency', 'date']).default('text'),
	transform: z.enum(['none', 'upper', 'lower', 'title']).default('none'),
	// fixed decimal places; null means "as written"
	decimals: z.number().int().min(0).max(6).nullable().default(null),
	// zero-pad the integer part to this many digits (1 = no padding), e.g.
	// 7 -> 007 for serials and bin numbers
	padDigits: z.number().int().min(1).max(21).default(1),
	// thousands separators, e.g. 1234.5 -> 1,234.50
	thousands: z.boolean().default(true),
	currency: z.enum(CURRENCIES).default('USD'),
	// show the code instead of the symbol: USD 4.99 rather than $4.99
	currencyCode: z.boolean().default(false),
	datePattern: z
		.enum(DATE_PATTERNS.map((p) => p.value) as [DatePattern, ...DatePattern[]])
		.default('iso'),
	prefix: z.string().max(8).default(''),
	suffix: z.string().max(8).default(''),
	// truncate long values with an ellipsis; 0 = no limit
	maxChars: z.number().int().min(0).max(200).default(0)
});
export type ColumnFormat = z.infer<typeof ColumnFormatSchema>;
export type FormatKind = ColumnFormat['kind'];
export const DEFAULT_FORMAT: ColumnFormat = ColumnFormatSchema.parse({});

/**
 * Which options each kind actually exposes. The dialog renders controls from
 * this, and editor.setFormat strips anything a kind doesn't own when the kind
 * changes, so a hidden setting can never keep applying.
 */
export const FORMAT_OPTIONS: Record<FormatKind, Set<keyof ColumnFormat>> = {
	text: new Set(['transform', 'prefix', 'suffix', 'maxChars']),
	number: new Set(['decimals', 'padDigits', 'thousands', 'prefix', 'suffix', 'maxChars']),
	currency: new Set([
		'decimals',
		'thousands',
		'currency',
		'currencyCode',
		'prefix',
		'suffix',
		'maxChars'
	]),
	date: new Set(['datePattern', 'prefix', 'suffix', 'maxChars'])
};

export const TemplateSchema = z.object({
	version: z.literal(1).default(1),
	id: z.string(),
	name: z.string().min(1).default('Untitled label'),
	// dots; width is capped by the 50 mm print head
	width: z.number().int().min(MIN_SIZE).max(MAX_PRINTHEAD_DOTS).default(LABEL_W),
	height: z
		.number()
		.int()
		.min(MIN_SIZE)
		.max(200 * DOTS_PER_MM)
		.default(LABEL_H),
	// Preview-only: the colour of the stock in the printer. Never affects the
	// raster, which is always black on white.
	stockColor: z
		.string()
		.regex(/^#[0-9a-f]{6}$/i)
		.default('#ffffff'),
	// Preview-only: die-cut corner rounding, as a percentage of the label's
	// SHORTER side, so the corner is a circular arc rather than an ellipse
	// stretched to the label's proportions — which is what a percentage
	// border-radius would draw, and not what a cutting die makes. 50 uses that
	// axis up entirely: a stadium on a rectangle, a circle on a square. The
	// head prints the same raster either way — ink in a cut-away corner just
	// lands off the label.
	stockRadius: z.number().int().min(0).max(50).default(0),
	// Which printer this label is designed for. Stored on the template because
	// the printable width differs between models, so the same design is not
	// valid on both — switching printers is a decision about the label, not a
	// transient connection detail.
	printer: z.enum(PRINTER_IDS).default('y50p'),
	// Which edge of the label feeds first. `left` rotates the raster a quarter
	// turn on the way out, so it is the HEIGHT that must fit across the head.
	// Only the NIIMBOT protocol carries this; YPL always feeds top-first.
	printDirection: z.enum(PRINT_DIRECTIONS).default('top'),
	// Draw order: later elements paint over earlier ones.
	elements: z.array(ElementSchema).default([]),
	// {{name}} binds directly to the CSV column called "name" — no mapping
	// step. Formatting per column lives here.
	formats: z.record(z.string(), ColumnFormatSchema).default({})
});

export type TextElement = z.infer<typeof TextElementSchema>;
export type BarcodeElement = z.infer<typeof BarcodeElementSchema>;
export type ImageElement = z.infer<typeof ImageElementSchema>;
export type IconElement = z.infer<typeof IconElementSchema>;
export type RectElement = z.infer<typeof RectElementSchema>;
export type AnyElement = z.infer<typeof ElementSchema>;
export type Template = z.infer<typeof TemplateSchema>;

export function blankTemplate(): Template {
	return TemplateSchema.parse({ id: crypto.randomUUID() });
}
