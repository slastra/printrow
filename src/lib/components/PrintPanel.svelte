<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { editor } from '$lib/template/editor.svelte';
	import { data } from '$lib/template/data.svelte';
	import { printer } from '$lib/printer/ble.svelte';
	import { buildPrintStream } from '$lib/template/raster';
	import { rowValues, unmappedVars } from '$lib/template/vars';
	import { Button } from '$lib/components/ui/button';
	import BluetoothIcon from '@lucide/svelte/icons/bluetooth';
	import BluetoothOffIcon from '@lucide/svelte/icons/bluetooth-off';
	import PrinterIcon from '@lucide/svelte/icons/printer';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';

	const unmapped = $derived(data.loaded ? unmappedVars(editor.template, data.columns) : []);

	async function connect() {
		try {
			await printer.connect();
			toast.success(`Connected to ${printer.deviceName}`);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'connection failed');
		}
	}

	/** Print row N always uses the row's real values, whatever the preview toggle. */
	function currentValues(): Record<string, string | undefined> {
		return data.loaded && data.previewRow
			? rowValues(editor.template.mapping, data.previewRow)
			: {};
	}

	async function run(builds: (() => Promise<Uint8Array>)[]) {
		try {
			const done = await printer.printJob(builds);
			if (done === builds.length) {
				toast.success(done === 1 ? 'Label printed' : `Printed ${done} labels`);
			} else {
				toast.info(`Cancelled after ${done} of ${builds.length}`);
			}
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'print failed');
		}
	}

	const printOne = () => run([() => buildPrintStream(editor.template, currentValues())]);

	const printBatch = () =>
		run(
			data.rows.map(
				(row) => () => buildPrintStream(editor.template, rowValues(editor.template.mapping, row))
			)
		);
</script>

<div class="space-y-3">
	{#if !printer.supported}
		<p class="text-sm text-muted-foreground">
			Web Bluetooth unavailable. On Linux enable
			<code class="text-xs">chrome://flags/#enable-web-bluetooth</code> and relaunch; serve over localhost
			or https.
		</p>
	{:else}
		<div class="flex items-center gap-2">
			{#if printer.connected}
				<Button variant="outline" size="sm" onclick={() => printer.disconnect()}>
					<BluetoothOffIcon /> Disconnect
				</Button>
				<span class="text-xs text-muted-foreground">{printer.deviceName}</span>
			{:else}
				<Button variant="outline" size="sm" onclick={connect}>
					<BluetoothIcon /> Connect
				</Button>
			{/if}
		</div>

		{#if printer.connected}
			<div class="flex items-center gap-2 text-sm">
				<span class="size-2 rounded-full {printer.statusColor}"></span>
				{printer.statusText}
				<Button
					variant="ghost"
					size="icon"
					class="size-7"
					disabled={printer.busy}
					onclick={() => printer.readStatus()}
				>
					<RefreshCwIcon />
				</Button>
			</div>

			{#if unmapped.length}
				<p class="text-xs text-red-500">
					Unmapped: {unmapped.map((v) => `{{${v}}}`).join(', ')} — these print as placeholders.
				</p>
			{/if}

			{#if printer.progress}
				<div class="space-y-2">
					<p class="text-sm tabular-nums">
						Printing {printer.progress.done}/{printer.progress.total}…
					</p>
					<Button variant="outline" size="sm" class="w-full" onclick={() => printer.cancel()}>
						Cancel
					</Button>
				</div>
			{:else}
				<div class="flex gap-2">
					<Button size="sm" disabled={printer.busy} onclick={printOne}>
						<PrinterIcon />
						{data.loaded ? `Print row ${data.previewIndex + 1}` : 'Print label'}
					</Button>
					{#if data.loaded}
						<Button size="sm" variant="secondary" disabled={printer.busy} onclick={printBatch}>
							Print all {data.rows.length}
						</Button>
					{/if}
				</div>
			{/if}
		{/if}
	{/if}
</div>
