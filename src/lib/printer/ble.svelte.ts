import { describeStatus, printJob } from '@slastra/yplib';
import {
	connect as connectBluetooth,
	hasBluetooth,
	isSecureContext,
	type BluetoothLink
} from '@slastra/yplib/web-bluetooth';

/**
 * Reactive shell over yplib's transport.
 *
 * The protocol, the chunking, the pacing and the job orchestration all live in
 * the library. What stays here is the part that is genuinely this app's: Svelte
 * state the components can bind to, and the Tailwind class for the status dot.
 */
class PrinterState {
	connected = $state(false);
	deviceName = $state<string | null>(null);
	status = $state<number | null>(null);
	busy = $state(false);
	progress = $state<{ done: number; total: number } | null>(null);

	private link: BluetoothLink = null as never;
	private aborter: AbortController | null = null;

	// Split, because the two failure modes need different fixes: a missing API
	// means wrong browser (or a Linux flag), an insecure context means the
	// origin is plain http. The About dialog reports them separately.
	get hasBluetooth(): boolean {
		return hasBluetooth();
	}

	get isSecure(): boolean {
		return isSecureContext();
	}

	get supported(): boolean {
		return this.hasBluetooth && this.isSecure;
	}

	get statusText(): string {
		return this.status === null ? 'unknown' : describeStatus(this.status);
	}

	/** Shared status-dot color so every surface renders "unknown" the same way. */
	get statusColor(): string {
		if (!this.connected || this.status === null) return 'bg-muted-foreground';
		return this.status === 0 ? 'bg-emerald-500' : 'bg-red-500';
	}

	async connect() {
		this.link = await connectBluetooth({
			onDisconnect: () => {
				this.connected = false;
				this.status = null;
			}
		});
		this.deviceName = this.link.deviceName;
		this.connected = true;
		await this.readStatus();
	}

	disconnect() {
		this.link?.disconnect();
	}

	async readStatus(): Promise<number | null> {
		const v = await this.link.readStatus();
		this.status = v;
		return v;
	}

	cancel() {
		this.aborter?.abort();
	}

	/**
	 * Run a print job: each entry builds one label's byte stream. Owns the
	 * busy/progress lifecycle so every print surface behaves the same; the
	 * library owns everything below that.
	 */
	async printJob(builds: (() => Promise<Uint8Array>)[]): Promise<number> {
		if (this.busy) throw new Error('a print job is already running');
		this.busy = true;
		this.progress = { done: 0, total: builds.length };
		this.aborter = new AbortController();
		try {
			return await printJob(this.link, builds, {
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
