<script lang="ts">
	import { editor } from '$lib/template/editor.svelte';
	import { DOTS_PER_MM, MEDIA_PRESETS, MEDIA_MIN_MM, MEDIA_MAX_H_MM } from '$lib/template/schema';
	import * as Select from '$lib/components/ui/select';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { fitsPrinter, printableWidthMm } from '$lib/printer/models';
	import { clamp } from '$lib/utils';
	import RulerIcon from '@lucide/svelte/icons/ruler';

	const model = $derived(editor.model);
	const headMm = $derived(printableWidthMm(model));
	// `left` feeds the label's left edge first, so it is the HEIGHT that has to
	// cross the head. Everything below keys off this rather than assuming width.
	const acrossIsHeight = $derived(editor.template.printDirection === 'left');
	const maxWmm = $derived(acrossIsHeight ? MEDIA_MAX_H_MM : headMm);
	const maxHmm = $derived(acrossIsHeight ? headMm : MEDIA_MAX_H_MM);

	/**
	 * Presets are listed whole, with the ones this printer cannot take marked
	 * rather than hidden: a 50 mm size vanishing from the list would read as a
	 * bug, where "too wide for the B1" reads as the hardware fact it is.
	 */
	const presets = $derived(
		MEDIA_PRESETS.map((p) => ({
			...p,
			fits: fitsPrinter(
				{ width: p.wMm * DOTS_PER_MM, height: p.hMm * DOTS_PER_MM },
				editor.template.printDirection,
				model
			).fits
		}))
	);

	const current = $derived(
		`${editor.template.width / DOTS_PER_MM}×${editor.template.height / DOTS_PER_MM}`
	);
	const isPreset = $derived(MEDIA_PRESETS.some((p) => `${p.wMm}×${p.hMm}` === current));
	const currentLabel = $derived(
		MEDIA_PRESETS.find((p) => `${p.wMm}×${p.hMm}` === current)?.label ??
			`${current.replace('×', ' × ')} mm`
	);

	let customOpen = $state(false);
	let wMm = $state(50);
	let hMm = $state(30);

	function onChange(value: string) {
		if (value === 'custom') {
			wMm = editor.template.width / DOTS_PER_MM;
			hMm = editor.template.height / DOTS_PER_MM;
			customOpen = true;
			return;
		}
		const [w, h] = value.split('×').map(Number);
		if (w && h) editor.setMedia(w, h);
	}

	function applyCustom() {
		// setMedia clamps to the SCHEMA's bounds, which span every model; the
		// selected printer's own, narrower head is enforced here so the dialog
		// cannot accept a size it just said was illegal
		editor.setMedia(
			clamp(Number(wMm) || 0, MEDIA_MIN_MM, maxWmm),
			clamp(Number(hMm) || 0, MEDIA_MIN_MM, maxHmm)
		);
		customOpen = false;
	}
</script>

<Select.Root type="single" value={isPreset ? current : 'custom'} onValueChange={onChange}>
	<Select.Trigger class="w-full">
		<RulerIcon class="size-4 text-muted-foreground" />
		{currentLabel}
	</Select.Trigger>
	<Select.Content>
		{#each presets as p (p.label)}
			<Select.Item value={`${p.wMm}×${p.hMm}`} disabled={!p.fits}>
				<span class="flex w-full items-center justify-between gap-3">
					<span>{p.label}</span>
					{#if !p.fits}
						<span class="text-xs text-muted-foreground">
							too {acrossIsHeight ? 'tall' : 'wide'} for {model.name}
						</span>
					{/if}
				</span>
			</Select.Item>
		{/each}
		<Select.Item value="custom">Custom…</Select.Item>
	</Select.Content>
</Select.Root>

<Dialog.Root bind:open={customOpen}>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Custom media size</Dialog.Title>
			<Dialog.Description>Label stock dimensions in millimetres.</Dialog.Description>
		</Dialog.Header>
		<form
			class="space-y-4"
			onsubmit={(e) => {
				e.preventDefault();
				applyCustom();
			}}
		>
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1.5">
					<Label for="media-w">Width (mm)</Label>
					<Input id="media-w" type="number" min={MEDIA_MIN_MM} max={maxWmm} bind:value={wMm} />
				</div>
				<div class="space-y-1.5">
					<Label for="media-h">Height (mm)</Label>
					<Input id="media-h" type="number" min={MEDIA_MIN_MM} max={maxHmm} bind:value={hMm} />
				</div>
			</div>
			<p class="text-xs text-muted-foreground">
				The {model.name} prints {headMm} mm across the head, so that is the limit on
				{editor.template.printDirection === 'left' ? 'height' : 'width'} — whichever dimension feeds across
				it. The other is free: the printer takes rows until the raster ends.
			</p>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (customOpen = false)}>Cancel</Button>
				<Button type="submit">Apply</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
