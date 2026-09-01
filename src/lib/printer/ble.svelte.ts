import { DRIVERS, type PrinterDriver, type PrinterLink, type PrinterStatus } from './drivers';
import type { RfidInfo } from '@slastra/nblib';
import { MODELS, type PrinterId, type PrintDirection } from './models';

/**
 * Reactive shell over whichever protocol library is driving.
 *
 * The framing, chunking, pacing and job orchestration all live behind the
 * driver seam — the two printers are shaped nothing alike below it. What stays
 * here is the part that is genuinely this app's: Svelte state the components
 * can bind to, and the Tailwind class for the status dot.
 */
class PrinterState {
	connected = $state(false);
	deviceName = $state<string | null>(null);
	status = $state<PrinterStatus | null>(null);
	busy = $state(false);
	progress = $state<{ done: number; total: number } | null>(null);
	/** Which model the open connection is to, or null when there isn't one. */
	connectedTo = $state<PrinterId | null>(null);

	private link: PrinterLink | null = null;
	private aborter: AbortController | null = null;

	// Split, because the two failure modes need different fixes: a missing API
	// means wrong browser (or a Linux flag), an insecure context means the
	// origin is plain http. The About dialog reports them separately.
	get hasBluetooth(): boolean {
		return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
	}

	get isSecure(): boolean {
		return typeof window !== 'undefined' && window.isSecureContext;
	}

	get supported(): boolean {
		return this.hasBluetooth && this.isSecure;
	}

	get statusText(): string {
		return this.status?.text ?? 'unknown';
	}

	/** Shared status-dot color so every surface renders "unknown" the same way. */
	get statusColor(): string {
		if (!this.connected || !this.status || this.status.ready === null) {
			return 'bg-muted-foreground';
		}
		return this.status.ready ? 'bg-emerald-500' : 'bg-red-500';
	}

	/**
	 * True when the open connection is not the printer the label is designed
	 * for. Printing anyway would rasterize for the wrong head, so the print
	 * surfaces refuse rather than guess which one the user meant.
	 */
	mismatched(templatePrinter: PrinterId): boolean {
		return this.connected && this.connectedTo !== null && this.connectedTo !== templatePrinter;
	}

	async connect(id: PrinterId) {
		const driver: PrinterDriver = DRIVERS[id];
		this.link = await driver.connect(() => {
			this.connected = false;
			this.status = null;
			this.connectedTo = null;
			this.link = null;
		});
		this.deviceName = this.link.deviceName;
		this.connected = true;
		this.connectedTo = id;
		await this.readStatus();
	}

	disconnect() {
		this.link?.disconnect();
	}

	/** Whether the connected printer can read the tag in its roll. */
	get canReadRfid(): boolean {
		return Boolean(this.link?.readRfid);
	}

	/**
	 * Read the loaded roll's RFID tag. Null covers both "no reader" and "no
	 * tag" — from the caller's side those are the same answer.
	 */
	async readRfid(): Promise<RfidInfo | null> {
		return (await this.link?.readRfid?.()) ?? null;
	}

	async readStatus(): Promise<PrinterStatus | null> {
		if (!this.link) return null;
		this.status = await this.link.readStatus();
		return this.status;
	}

	cancel() {
		this.aborter?.abort();
	}

	/**
	 * Run a print job: each entry renders one label's canvas. Owns the
	 * busy/progress lifecycle so every print surface behaves the same; the
	 * driver owns everything below that.
	 */
	async printJob(
		builds: (() => Promise<HTMLCanvasElement>)[],
		settings: { density: number; labelType: number; direction: PrintDirection }
	): Promise<number> {
		if (!this.link) throw new Error('no printer connected');
		if (this.busy) throw new Error('a print job is already running');
		this.busy = true;
		this.progress = { done: 0, total: builds.length };
		this.aborter = new AbortController();
		try {
			return await this.link.print(builds, {
				...settings,
				signal: this.aborter.signal,
				onProgress: (done, total) => (this.progress = { done, total })
			});
		} finally {
			this.busy = false;
			this.progress = null;
			this.aborter = null;
		}
	}
}

export const printer = new PrinterState();
export { MODELS };
