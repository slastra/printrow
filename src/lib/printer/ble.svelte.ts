import { describeStatus, parseReplies, request } from './protocol';

const SERVICE = 0x18f0;
const WRITE_UUID = 0x2af1;
const NOTIFY_UUID = 0x2af0;
// 20-byte chunks fit the 23-byte default ATT MTU; 8 ms pacing mirrors the
// hardware-verified Python driver — writeValueWithoutResponse has no
// backpressure, so unpaced writes can outrun the printer's buffer.
const CHUNK = 20;
const PACE_MS = 8;
const STATUS_TIMEOUT_MS = 500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Web Bluetooth link to the Y50P. Discovery filters by namePrefix, never by
 * service UUID — a service filter makes Chrome push a SetDiscoveryFilter UUID
 * list to BlueZ, which segfaults bluetoothd 5.87 on desktop Linux (verified in
 * tspl-bluetooth-print's FINDINGS.md). getDevices() reconnects a previously
 * permitted printer with no scan at all.
 *
 * Job orchestration (busy/progress/cancel) lives here, not in components, so
 * every print surface gets the same state machine.
 */
class PrinterState {
	connected = $state(false);
	deviceName = $state<string | null>(null);
	status = $state<number | null>(null);
	busy = $state(false);
	progress = $state<{ done: number; total: number } | null>(null);

	private cancelRequested = false;
	private writeChar: BluetoothRemoteGATTCharacteristic | null = null;
	private inbox: number[] = [];
	private statusWaiter: ((status: number) => void) | null = null;

	get supported(): boolean {
		return typeof navigator !== 'undefined' && 'bluetooth' in navigator && window.isSecureContext;
	}

	get statusText(): string {
		return this.status === null ? 'unknown' : describeStatus(this.status);
	}

	/** Shared status-dot color so every surface renders "unknown" the same way. */
	get statusColor(): string {
		if (!this.connected || this.status === null) return 'bg-muted-foreground';
		return this.status === 0 ? 'bg-emerald-500' : 'bg-red-500';
	}

	private async pickDevice(): Promise<BluetoothDevice> {
		if (navigator.bluetooth.getDevices) {
			try {
				const known = await navigator.bluetooth.getDevices();
				const hit = known.find((d) => (d.name ?? '').startsWith('Y50P'));
				if (hit) return hit;
			} catch {
				// permissions backend flag off — fall through to a scan
			}
		}
		return navigator.bluetooth.requestDevice({
			filters: [{ namePrefix: 'Y50P' }],
			optionalServices: [SERVICE]
		});
	}

	async connect() {
		const device = await this.pickDevice();
		device.addEventListener('gattserverdisconnected', () => {
			this.connected = false;
			this.writeChar = null;
			this.status = null;
		});
		if (!device.gatt) throw new Error('device has no GATT server');
		const service = await (await device.gatt.connect()).getPrimaryService(SERVICE);
		this.writeChar = await service.getCharacteristic(WRITE_UUID);
		const notifyChar = await service.getCharacteristic(NOTIFY_UUID);
		await notifyChar.startNotifications();
		notifyChar.addEventListener('characteristicvaluechanged', (e) => {
			const value = (e.target as BluetoothRemoteGATTCharacteristic).value;
			if (value) {
				this.inbox.push(...new Uint8Array(value.buffer));
				this.drainInbox();
			}
		});
		this.deviceName = device.name ?? 'Y50P';
		this.connected = true;
		await this.readStatus();
	}

	disconnect() {
		this.writeChar?.service.device.gatt?.disconnect();
	}

	/** Resolve a pending status read the moment the reply frame arrives. */
	private drainInbox() {
		if (!this.statusWaiter) return;
		const hit = parseReplies(Uint8Array.from(this.inbox)).find(
			(r) => r.group === 0x05 && r.cmd === 0x0b
		);
		if (!hit) return;
		const v = typeof hit.value === 'number' ? hit.value : (hit.value[0] ?? 0);
		this.statusWaiter(v);
		this.statusWaiter = null;
	}

	async send(bytes: Uint8Array) {
		if (!this.writeChar) throw new Error('not connected');
		for (let i = 0; i < bytes.length; i += CHUNK) {
			// slice, not subarray: the hardware-verified driver sends a copied
			// chunk, and a view over a shared buffer is not worth the risk on a
			// link with no backpressure.
			await this.writeChar.writeValueWithoutResponse(
				bytes.slice(i, i + CHUNK) as Uint8Array<ArrayBuffer>
			);
			await sleep(PACE_MS);
		}
	}

	async readStatus(): Promise<number | null> {
		this.inbox = [];
		const reply = new Promise<number | null>((resolve) => {
			this.statusWaiter = resolve;
			// fallback: printer silent — resolve null rather than hang
			setTimeout(() => {
				if (this.statusWaiter === resolve) {
					this.statusWaiter = null;
					resolve(null);
				}
			}, STATUS_TIMEOUT_MS);
		});
		await this.send(request(0x05, 0x0b));
		const v = await reply;
		if (v !== null) this.status = v;
		else this.status = null;
		return v;
	}

	/**
	 * Poll until the printer reports ready. 0x01 (printing) keeps waiting;
	 * cover-open / out-of-paper / silence past the timeout throws so a batch
	 * stops at the failed label instead of spooling bytes into the void.
	 */
	async waitReady(timeoutMs = 15000): Promise<void> {
		const t0 = Date.now();
		for (;;) {
			const s = await this.readStatus();
			if (s === 0) return;
			if (s !== null && s !== 0x01) throw new Error(`printer not ready: ${describeStatus(s)}`);
			if (Date.now() - t0 > timeoutMs)
				throw new Error(s === null ? 'printer not responding' : 'timed out waiting for printer');
			await sleep(300);
		}
	}

	cancel() {
		this.cancelRequested = true;
	}

	/**
	 * Run a print job: each entry builds one label's byte stream. Owns the
	 * busy/progress/cancel lifecycle, waits for the printer between labels,
	 * and renders label i+1 while label i is still transferring.
	 *
	 * Returns the number of labels printed; throws on printer errors after
	 * cleaning up its own state.
	 */
	async printJob(builds: (() => Promise<Uint8Array>)[]): Promise<number> {
		if (this.busy) throw new Error('a print job is already running');
		this.cancelRequested = false;
		this.busy = true;
		this.progress = { done: 0, total: builds.length };
		let done = 0;
		try {
			let next: Promise<Uint8Array> | undefined = builds[0]?.();
			for (let i = 0; i < builds.length; i++) {
				if (this.cancelRequested) break;
				const stream = await next!;
				await this.waitReady();
				next = builds[i + 1]?.(); // render the next label during this transfer
				await this.send(stream);
				done = i + 1;
				this.progress = { done, total: builds.length };
			}
			return done;
		} finally {
			this.busy = false;
			this.progress = null;
		}
	}
}

export const printer = new PrinterState();
