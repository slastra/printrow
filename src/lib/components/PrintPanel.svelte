<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { editor } from '$lib/template/editor.svelte';
	import { data } from '$lib/template/data.svelte';
	import { printer } from '$lib/printer/ble.svelte';
	import { buildPrintStream } from '$lib/template/raster';
	import { resolveValues, unknownVars } from '$lib/template/vars';
	import { Button } from '$lib/components/ui/button';
	import PrinterIcon from '@lucide/svelte/icons/printer';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';

	const unknown = $derived(data.loaded ? unknownVars(editor.template, data.columns) : []);

	/** Print row N always uses the row's real values, whatever the preview toggle. */
	function currentValues(): Record<string, string | undefined> {
		return resolveValues(data.previewRow, editor.template.formats);
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
				(row) => () =>
					buildPrintStream(editor.template, resolveValues(row, editor.template.formats))
			)
		);
</script>

<div class="space-y-3">
	<div class="flex items-center gap-2 text-sm">
		<span class="size-2 rounded-full {printer.statusColor}"></span>
		{printer.statusText}
		<span class="text-xs text-muted-foreground">{printer.deviceName}</span>
		<Button
			variant="ghost"
			size="icon"
			class="ml-auto size-7"
			disabled={printer.busy}
			onclick={() => printer.readStatus()}
		>
			<RefreshCwIcon />
		</Button>
	</div>

	{#if unknown.length}
		<p class="text-xs text-amber-600 dark:text-amber-500">
			{unknown.map((v) => `{{${v}}}`).join(', ')} has no matching column.
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
</div>
