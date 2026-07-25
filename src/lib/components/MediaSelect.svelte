<script lang="ts">
	import { editor } from '$lib/template/editor.svelte';
	import { DOTS_PER_MM, MEDIA_PRESETS } from '$lib/template/schema';
	import * as Select from '$lib/components/ui/select';
	import RulerIcon from '@lucide/svelte/icons/ruler';

	const current = $derived(
		`${editor.template.width / DOTS_PER_MM}×${editor.template.height / DOTS_PER_MM}`
	);
	const currentLabel = $derived(
		MEDIA_PRESETS.find((p) => `${p.wMm}×${p.hMm}` === current)?.label ??
			`${current.replace('×', ' × ')} mm`
	);

	function onChange(value: string) {
		const [w, h] = value.split('×').map(Number);
		if (w && h) editor.setMedia(w, h);
	}
</script>

<Select.Root type="single" value={current} onValueChange={onChange}>
	<Select.Trigger class="h-9 gap-2 tool-surface">
		<RulerIcon class="size-4 text-muted-foreground" />
		{currentLabel}
	</Select.Trigger>
	<Select.Content side="top">
		{#each MEDIA_PRESETS as p (p.label)}
			<Select.Item value={`${p.wMm}×${p.hMm}`}>{p.label}</Select.Item>
		{/each}
	</Select.Content>
</Select.Root>
