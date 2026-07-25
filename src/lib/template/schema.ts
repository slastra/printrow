import { z } from 'zod';
import { WIDTH, HEIGHT } from '$lib/printer/protocol';

// The Y50P takes a fixed 400×240 1-bit framebuffer (50×30 mm at 8 dots/mm).
// All geometry is in printer dots — the editor stage, print renderer, and wire
// format share one coordinate space, with zoom applied only at display time.
// The wire format (protocol.ts) owns the physical constants; re-exported here
// so one definition serves both sides of the raster boundary.
export const DOTS_PER_MM = 8;
export const LABEL_W = WIDTH;
export const LABEL_H = HEIGHT;

// Shared bounds: the zod schema and every gesture/mutation clamp must agree,
// or clamped-in-view values can produce elements the schema later rejects.
export const MIN_SIZE = 8;
export const MIN_FONT_SIZE = 6;
export const MAX_FONT_SIZE = 200;

// Height is safe to vary — the printer takes rows until the raster ends.
// Width rides in the setup frames in mm; only 50 mm is hardware-verified.
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
	{ label: '40 × 30 mm', wMm: 40, hMm: 30 },
	{ label: '40 × 60 mm', wMm: 40, hMm: 60 },
	{ label: '30 × 20 mm', wMm: 30, hMm: 20 }
];

// Bundled via @fontsource-variable/inter so every machine rasterizes text
// identically — system fonts would make the same template print differently
// per device.
export const DEFAULT_FONT = "'Inter Variable', sans-serif";

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
	groupId: z.string().optional()
};

export const TextElementSchema = z.object({
	...base,
	type: z.literal('text'),
	// May contain {{var}} placeholders resolved from a CSV row at print time.
	text: z.string(),
	fontSize: z.number().int().min(MIN_FONT_SIZE).max(MAX_FONT_SIZE).default(32),
	bold: z.boolean().default(true),
	italic: z.boolean().default(false),
	underline: z.boolean().default(false),
	align: z.enum(['left', 'center', 'right']).default('left'),
	// Shrink until the wrapped text fits the box — essential when a CSV value
	// runs longer than the sample the template was designed around.
	autoFit: z.boolean().default(true)
});

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
	mode: z.enum(['threshold', 'dither']).default('threshold')
});

export const RectElementSchema = z.object({
	...base,
	type: z.literal('rect'),
	solid: z.boolean().default(false),
	thickness: z.number().int().min(1).max(50).default(2),
	borderStyle: z.enum(['solid', 'dashed', 'dotted']).default('solid'),
	// corner radius in dots; applies to fill and border alike
	radius: z.number().int().min(0).max(120).default(0)
});

export const ElementSchema = z.discriminatedUnion('type', [
	TextElementSchema,
	BarcodeElementSchema,
	ImageElementSchema,
	RectElementSchema
]);

/**
 * Per-column display formatting, applied wherever {{column}} is substituted.
 * Kept on the template (not the CSV) so the same formatting survives a
 * re-import of next week's data.
 */
export const ColumnFormatSchema = z.object({
	transform: z.enum(['none', 'upper', 'lower', 'title']).default('none'),
	// fixed decimal places for numeric columns; null leaves the text as-is
	decimals: z.number().int().min(0).max(6).nullable().default(null),
	// thousands separators, e.g. 1234.5 -> 1,234.50
	thousands: z.boolean().default(false),
	prefix: z.string().max(8).default(''),
	suffix: z.string().max(8).default(''),
	// truncate long values with an ellipsis; 0 = no limit
	maxChars: z.number().int().min(0).max(200).default(0)
});
export type ColumnFormat = z.infer<typeof ColumnFormatSchema>;

export const TemplateSchema = z.object({
	version: z.literal(1).default(1),
	id: z.string(),
	name: z.string().min(1).default('Untitled label'),
	// dots; width is capped by the 50 mm print head
	width: z.number().int().min(MIN_SIZE).max(WIDTH).default(LABEL_W),
	height: z
		.number()
		.int()
		.min(MIN_SIZE)
		.max(200 * DOTS_PER_MM)
		.default(LABEL_H),
	// Draw order: later elements paint over earlier ones.
	elements: z.array(ElementSchema).default([]),
	// {{name}} binds directly to the CSV column called "name" — no mapping
	// step. Formatting per column lives here.
	formats: z.record(z.string(), ColumnFormatSchema).default({})
});

export type TextElement = z.infer<typeof TextElementSchema>;
export type BarcodeElement = z.infer<typeof BarcodeElementSchema>;
export type ImageElement = z.infer<typeof ImageElementSchema>;
export type RectElement = z.infer<typeof RectElementSchema>;
export type AnyElement = z.infer<typeof ElementSchema>;
export type Template = z.infer<typeof TemplateSchema>;

export function blankTemplate(): Template {
	return TemplateSchema.parse({ id: crypto.randomUUID() });
}
