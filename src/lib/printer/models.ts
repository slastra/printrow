import { LabelType, type PrintDirection } from '@slastra/nblib';

export type { PrintDirection };

export type PrinterId = 'y50p' | 'b1';

export interface LabelTypeOption {
	value: number;
	label: string;
}

/**
 * What each supported printer physically is. Pure metadata, deliberately free
 * of any transport import, so the template schema can depend on it without
 * dragging Web Bluetooth into the SSR bundle.
 *
 * The head width is the field that matters most: it is a HARD cap on whichever
 * of the label's dimensions crosses the head, and the two supported printers
 * disagree about it by 2 mm — exactly enough to make a 50 mm template
 * unprintable on one of them.
 */
export interface PrinterModel {
	readonly id: PrinterId;
	readonly name: string;
	/** One line for the picker, naming what makes this model different. */
	readonly blurb: string;
	readonly dotsPerMm: number;
	/** Dots across the print head. */
	readonly printheadDots: number;
	readonly maxHeightMm: number;
	/** Which controls this model exposes. */
	readonly features: { direction: boolean; density: boolean; labelType: boolean };
	readonly densityRange: [number, number];
	readonly defaultDensity: number;
	readonly labelTypes: LabelTypeOption[];
	readonly defaultLabelType: number;
}

export const MODELS: Record<PrinterId, PrinterModel> = {
	y50p: {
		id: 'y50p',
		name: 'KNAON Y50P',
		blurb: '50 mm wide, 203 dpi. Also the FlashToy U8 and its white-label siblings.',
		dotsPerMm: 8,
		printheadDots: 400,
		maxHeightMm: 200,
		// The YPL protocol has no notion of print direction, density or stock
		// type: the raster is sent top-first and the printer decides the rest.
		features: { direction: false, density: false, labelType: false },
		densityRange: [1, 1],
		defaultDensity: 1,
		labelTypes: [],
		defaultLabelType: 0
	},
	b1: {
		id: 'b1',
		name: 'NIIMBOT B1',
		blurb: '48 mm printable, 203 dpi. Takes gap, black-mark or transparent stock.',
		dotsPerMm: 8,
		// 384 dots is 48 mm, NOT the 50 mm the stock is: a 50 mm design does not
		// fit across this head.
		printheadDots: 384,
		maxHeightMm: 200,
		features: { direction: true, density: true, labelType: true },
		densityRange: [1, 5],
		defaultDensity: 3,
		labelTypes: [
			{ value: LabelType.WithGaps, label: 'Gap' },
			{ value: LabelType.Black, label: 'Black mark' },
			{ value: LabelType.Transparent, label: 'Transparent' }
		],
		defaultLabelType: LabelType.WithGaps
	}
};

export const MODEL_LIST: PrinterModel[] = [MODELS.y50p, MODELS.b1];

/** The widest head of any supported model, which is what bounds the schema. */
export const MAX_PRINTHEAD_DOTS = Math.max(...MODEL_LIST.map((m) => m.printheadDots));

/** Dots across the head, in millimetres — the printable width. */
export function printableWidthMm(model: PrinterModel): number {
	return model.printheadDots / model.dotsPerMm;
}

/**
 * Which of a label's two dimensions crosses the print head.
 *
 * `left` feeds the design's left edge first, i.e. the raster is rotated a
 * quarter turn, so it is the HEIGHT that has to fit. This is the setting that
 * silently prints a label sideways when it disagrees with the stock.
 */
export function acrossHeadDots(
	size: { width: number; height: number },
	direction: PrintDirection
): number {
	return direction === 'left' ? size.height : size.width;
}

/** Whether a label fits this printer, and why not when it does not. */
export function fitsPrinter(
	size: { width: number; height: number },
	direction: PrintDirection,
	model: PrinterModel
): { fits: boolean; across: number; reason?: string } {
	const across = acrossHeadDots(size, direction);
	if (across <= model.printheadDots) return { fits: true, across };
	const mm = (d: number) => Math.round((d / model.dotsPerMm) * 10) / 10;
	return {
		fits: false,
		across,
		reason: `${mm(across)} mm across the head, and the ${model.name} prints ${mm(model.printheadDots)} mm`
	};
}
