import {
	describeStatus,
	imageDataToRows as ypRows,
	buildStream,
	printJob as ypPrint
} from '@slastra/yplib';
import { connect as ypConnect } from '@slastra/yplib/web-bluetooth';
import {
	buildPage,
	describeHeartbeat,
	imageDataToRows as nbRows,
	printJob as nbPrint,
	readHeartbeat
} from '@slastra/nblib';
import {
	connect as nbConnect,
	hasBluetooth as nbHasBluetooth,
	isSecureContext as nbIsSecure
} from '@slastra/nblib/web-bluetooth';
import { MODELS, type PrintDirection, type PrinterId, type PrinterModel } from './models';

/** What the status dot and its caption say. */
export interface PrinterStatus {
	ready: boolean;
	text: string;
}

export interface PrintRunOptions {
	/** Burn density. Ignored by printers that do not expose it. */
	density: number;
	/** Stock type. Ignored by printers that do not expose it. */
	labelType: number;
	/** Which edge of the label feeds first. */
	direction: PrintDirection;
	onProgress?: (done: number, total: number) => void;
	signal?: AbortSignal;
}

/**
 * A connected printer, in the vocabulary this app uses. Everything below the
 * seam — framing, rasterizing, chunking, pacing — belongs to the protocol
 * library behind it, and the two are shaped nothing alike: YPL streams a
 * framed raster one way, NIIMBOT holds a request/response conversation.
 */
export interface PrinterLink {
	readonly deviceName: string;
	disconnect(): void;
	readStatus(): Promise<PrinterStatus>;
	/**
	 * Print each canvas, rendered lazily so a thousand-row batch does not
	 * rasterize a thousand labels up front.
	 */
	print(builds: (() => Promise<HTMLCanvasElement>)[], options: PrintRunOptions): Promise<number>;
}

export interface PrinterDriver {
	readonly model: PrinterModel;
	hasBluetooth(): boolean;
	isSecureContext(): boolean;
	connect(onDisconnect: () => void): Promise<PrinterLink>;
}

function imageData(cv: HTMLCanvasElement): ImageData {
	const ctx = cv.getContext('2d', { willReadFrequently: true });
	if (!ctx) throw new Error('canvas has no 2d context');
	return ctx.getImageData(0, 0, cv.width, cv.height);
}

const y50p: PrinterDriver = {
	model: MODELS.y50p,
	hasBluetooth: () => typeof navigator !== 'undefined' && 'bluetooth' in navigator,
	isSecureContext: () => typeof window !== 'undefined' && window.isSecureContext,
	async connect(onDisconnect) {
		const link = await ypConnect({ onDisconnect });
		return {
			deviceName: link.deviceName,
			disconnect: () => link.disconnect(),
			async readStatus() {
				const v = await link.readStatus();
				return { ready: v === 0, text: v === null ? 'unknown' : describeStatus(v) };
			},
			print(builds, { onProgress, signal }) {
				return ypPrint(
					link,
					builds.map((build) => async () => {
						const cv = await build();
						// YPL carries the media width in millimetres and refuses a row
						// that is not exactly that wide, so it comes from the canvas
						return buildStream(ypRows(imageData(cv)), Math.round(cv.width / 8));
					}),
					{ onProgress, signal }
				);
			}
		};
	}
};

const b1: PrinterDriver = {
	model: MODELS.b1,
	hasBluetooth: nbHasBluetooth,
	isSecureContext: nbIsSecure,
	async connect(onDisconnect) {
		const link = await nbConnect({ onDisconnect });
		return {
			deviceName: link.deviceName,
			disconnect: () => link.disconnect(),
			async readStatus() {
				try {
					const hb = await readHeartbeat(link);
					const text = describeHeartbeat(hb);
					return { ready: text === 'ready', text };
				} catch {
					// a printer mid-job answers its heartbeat late; unknown beats a lie
					return { ready: false, text: 'unknown' };
				}
			},
			print(builds, { density, labelType, direction, onProgress, signal }) {
				return nbPrint(
					link,
					builds.map((build) => async () => {
						const cv = await build();
						return buildPage(nbRows(imageData(cv)), {
							direction,
							printheadPixels: MODELS.b1.printheadDots
						});
					}),
					{ density, labelType, onProgress, signal }
				);
			}
		};
	}
};

export const DRIVERS: Record<PrinterId, PrinterDriver> = { y50p, b1 };
