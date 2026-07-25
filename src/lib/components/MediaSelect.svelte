<script lang="ts">
	import { editor } from '$lib/template/editor.svelte';
	import { DOTS_PER_MM, MEDIA_PRESETS } from '$lib/template/schema';
	import { clamp } from '$lib/utils';
	import * as Select from '$lib/components/ui/select';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import RulerIcon from '@lucide/svelte/icons/ruler';

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
		editor.setMedia(
			clamp(Math.round(Number(wMm) || 0), 10, 50),
			clamp(Math.round(Number(hMm) || 0), 10, 200)
		);
		customOpen = false;
	}
</script>

<Select.Root type="single" value={isPreset ? current : 'custom'} onValueChange={onChange}>
	<!-- explicit utilities (not the tool-surface class) so tailwind-merge
	     reliably overrides the trigger's own border/bg/shadow defaults; the
	     chevron flips up because the menu opens upward -->
	<Select.Trigger
		class="h-9 gap-2 rounded-lg border-border bg-card/85 shadow-[0_1px_2px_rgb(0_0_0/0.06),0_8px_24px_-8px_rgb(0_0_0/0.18)] backdrop-blur-[10px] dark:bg-card/85 dark:hover:bg-card [&>svg:last-child]:rotate-180"
	>
		<RulerIcon class="size-4 text-muted-foreground" />
		{currentLabel}
	</Select.Trigger>
	<Select.Content side="top">
		{#each MEDIA_PRESETS as p (p.label)}
			<Select.Item value={`${p.wMm}×${p.hMm}`}>{p.label}</Select.Item>
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
					<Input id="media-w" type="number" min="10" max="50" bind:value={wMm} />
				</div>
				<div class="space-y-1.5">
					<Label for="media-h">Height (mm)</Label>
					<Input id="media-h" type="number" min="10" max="200" bind:value={hMm} />
				</div>
			</div>
			<p class="text-xs text-muted-foreground">
				Width is limited to 50 mm by the print head. 50 mm-wide stock is hardware-verified; other
				widths follow the protocol spec.
			</p>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (customOpen = false)}>Cancel</Button>
				<Button type="submit">Apply</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
