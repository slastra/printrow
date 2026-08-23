<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { editor } from '$lib/template/editor.svelte';
	import { data } from '$lib/template/data.svelte';
	import { printer } from '$lib/printer/ble.svelte';
	import { buildPrintCanvas } from '$lib/template/raster';
	import { MODELS } from '$lib/printer/models';
	import { parseRowSpec, describeRows } from '$lib/template/rows';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Select from '$lib/components/ui/select';
	import { Slider } from '$lib/components/ui/slider';
	import { cn } from '$lib/utils';
	import BluetoothIcon from '@lucide/svelte/icons/bluetooth';
	import BluetoothOffIcon from '@lucide/svelte/icons/bluetooth-off';
	import PrinterIcon from '@lucide/svelte/icons/printer';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let connecting = $state(false);
	const unknown = $derived(data.unknownVars);
	const model = $derived(MODELS[editor.template.printer]);
	const fit = $derived(editor.fit);
	const mismatched = $derived(printer.mismatched(editor.template.printer));
	/** Nothing may print while the label cannot be rasterized for this head. */
	const blocked = $derived(!fit.fits || mismatched);

	// Session settings, not template ones: density is a preference and label
	// type describes the roll currently loaded, both of which can differ from
	// one print run to the next. They reset to the model's defaults when the
	// target printer changes.
	let density = $state(3);
	let labelType = $state(1);
	$effect(() => {
		density = model.defaultDensity;
		labelType = model.defaultLabelType;
	});

	async function connect() {
		if (!printer.supported) {
			toast.error('Web Bluetooth unavailable', {
				description:
					'On Linux enable chrome://flags/#enable-web-bluetooth and relaunch; needs localhost or https.'
			});
			return;
		}
		connecting = true;
		try {
			await printer.connect(editor.template.printer);
			toast.success(`Connected to ${printer.deviceName}`);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'connection failed');
		} finally {
			connecting = false;
		}
	}

	async function run(builds: (() => Promise<HTMLCanvasElement>)[]) {
		try {
			const done = await printer.printJob(builds, {
				density,
				labelType,
				direction: editor.template.printDirection
			});
			if (done === builds.length) {
				toast.success(done === 1 ? 'Label printed' : `Printed ${done} labels`);
			} else {
				toast.info(`Cancelled after ${done} of ${builds.length}`);
			}
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'print failed');
		}
	}

	const build = (row: Record<string, string> | undefined) => () =>
		buildPrintCanvas(editor.template, data.valuesFor(row));

	/** Print row N always uses the row's real values, whatever the preview toggle. */
	const printOne = () => run([build(data.previewRow)]);

	const printBatch = () => run(data.rows.map((row) => build(row)));

	// --- subset --------------------------------------------------------------

	let spec = $state('');
	const selection = $derived(parseRowSpec(spec, data.rows.length));
	const count = $derived(selection.indices.length);

	const printSubset = () => run(selection.indices.map((i) => build(data.rows[i])));
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Print</Dialog.Title>
			<Dialog.Description>
				{#if printer.connected}
					Connected over Bluetooth.
				{:else}
					Connect to a {model.name} over Bluetooth.
				{/if}
			</Dialog.Description>
		</Dialog.Header>

		{#if !printer.connected}
			<div class="space-y-3">
				<Button class="w-full" disabled={connecting} onclick={connect}>
					<BluetoothIcon />
					{connecting ? 'Connecting…' : 'Connect printer'}
				</Button>
				{#if !printer.supported}
					<p class="text-xs text-muted-foreground">
						Web Bluetooth is unavailable here. On Linux enable
						<code class="text-[11px]">chrome://flags/#enable-web-bluetooth</code>, relaunch Chrome,
						and serve over localhost or https.
					</p>
				{/if}
			</div>
		{:else}
			<div class="space-y-4">
				<div class="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
					<span class={cn('size-2 shrink-0 rounded-full', printer.statusColor)}></span>
					<span class="min-w-0 flex-1">
						<span class="block truncate font-mono text-xs">{printer.deviceName}</span>
						<span class="block text-xs text-muted-foreground">{printer.statusText}</span>
					</span>
					<Button
						variant="ghost"
						size="icon"
						class="size-7 shrink-0 cursor-pointer"
						title="Refresh status"
						disabled={printer.busy}
						onclick={() => printer.readStatus()}
					>
						<RefreshCwIcon class="size-3.5" />
					</Button>
				</div>

				{#if unknown.length}
					<p class="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-500">
						<TriangleAlertIcon class="mt-px size-3.5 shrink-0" />
						<span>
							Bad variable {unknown.length > 1 ? 'names' : 'name'}: {unknown.join(', ')}
						</span>
					</p>
				{/if}

				{#if !fit.fits}
					<p class="flex items-start gap-1.5 text-xs text-destructive">
						<TriangleAlertIcon class="mt-px size-3.5 shrink-0" />
						<span>This label is {fit.reason}. Resize it in the label panel.</span>
					</p>
				{/if}

				{#if mismatched}
					<p class="flex items-start gap-1.5 text-xs text-destructive">
						<TriangleAlertIcon class="mt-px size-3.5 shrink-0" />
						<span>
							Connected to a {MODELS[printer.connectedTo ?? 'y50p'].name}, but this label is
							designed for a {model.name}. Disconnect, or switch the label's printer.
						</span>
					</p>
				{/if}

				{#if model.features.density || model.features.labelType}
					<div class="grid grid-cols-2 gap-3">
						{#if model.features.density}
							<div class="space-y-1.5">
								<div class="flex items-center justify-between">
									<Label class="text-xs text-muted-foreground">Density</Label>
									<span class="text-xs text-muted-foreground tabular-nums">{density}</span>
								</div>
								<!-- the slider has no room for its own value, so the label row
								     carries it, the way the inspector's sliders do -->
								<div class="flex h-8 items-center">
									<Slider
										type="single"
										value={density}
										onValueChange={(v) => (density = v)}
										min={model.densityRange[0]}
										max={model.densityRange[1]}
										step={1}
									/>
								</div>
							</div>
						{/if}
						{#if model.features.labelType}
							<div class="space-y-1.5">
								<Label class="text-xs text-muted-foreground">Stock</Label>
								<Select.Root
									type="single"
									value={String(labelType)}
									onValueChange={(v) => (labelType = Number(v))}
								>
									<Select.Trigger class="h-8 w-full text-xs">
										{model.labelTypes.find((t) => t.value === labelType)?.label ?? 'Gap'}
									</Select.Trigger>
									<Select.Content>
										{#each model.labelTypes as t (t.value)}
											<Select.Item value={String(t.value)} label={t.label} />
										{/each}
									</Select.Content>
								</Select.Root>
							</div>
						{/if}
					</div>
				{/if}

				{#if printer.progress}
					<div class="space-y-2">
						<div class="flex items-center justify-between text-sm">
							<span>Printing…</span>
							<span class="text-muted-foreground tabular-nums">
								{printer.progress.done}/{printer.progress.total}
							</span>
						</div>
						<div class="h-1.5 overflow-hidden rounded-full bg-muted">
							<div
								class="h-full rounded-full bg-primary transition-[width] duration-200"
								style="width: {(printer.progress.done / printer.progress.total) * 100}%"
							></div>
						</div>
						<Button variant="outline" size="sm" class="w-full" onclick={() => printer.cancel()}>
							Cancel
						</Button>
					</div>
				{:else}
					<div class="space-y-2">
						<Button class="w-full" disabled={printer.busy || blocked} onclick={printOne}>
							<PrinterIcon />
							{data.loaded ? `Print row ${data.previewIndex + 1}` : 'Print label'}
						</Button>
						{#if data.loaded}
							<Button
								variant="secondary"
								class="w-full"
								disabled={printer.busy || blocked}
								onclick={printBatch}
							>
								<LayersIcon />
								Print all {data.rows.length} labels
							</Button>

							<div class="space-y-1.5 pt-1">
								<Label for="row-spec" class="text-xs text-muted-foreground">Or a subset</Label>
								<div class="flex gap-2">
									<Input
										id="row-spec"
										bind:value={spec}
										placeholder="1-5, 8, 12-20"
										autocomplete="off"
										spellcheck={false}
										aria-invalid={Boolean(selection.error)}
										class="font-mono text-xs"
										onkeydown={(e) => {
											if (e.key === 'Enter' && count && !printer.busy && !blocked) printSubset();
										}}
									/>
									<Button
										variant="outline"
										class="shrink-0"
										disabled={printer.busy || blocked || !count}
										onclick={printSubset}
									>
										<PrinterIcon />
										Print{count ? ` ${count}` : ''}
									</Button>
								</div>
								<p class="text-xs {selection.error ? 'text-destructive' : 'text-muted-foreground'}">
									{#if selection.error}
										{selection.error}
									{:else if count}
										{count === 1 ? 'Row' : 'Rows'}
										{describeRows(selection.indices)}, in that order.
									{:else}
										Type row numbers to print only those, in document order.
									{/if}
								</p>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/if}

		{#if printer.connected}
			<Dialog.Footer class="sm:justify-start">
				<Button
					variant="ghost"
					size="sm"
					class="text-muted-foreground"
					disabled={printer.busy}
					onclick={() => printer.disconnect()}
				>
					<BluetoothOffIcon /> Disconnect
				</Button>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>
