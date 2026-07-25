<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { editor } from '$lib/template/editor.svelte';
	import { data } from '$lib/template/data.svelte';
	import { formatValue } from '$lib/template/vars';
	import VarChip from './VarChip.svelte';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal';

	let {
		column,
		inUse,
		onformat
	}: { column: string; inUse: boolean; onformat: (column: string) => void } = $props();

	const customized = $derived(editor.isFormatted(column));
	const sample = $derived(formatValue(data.previewRow?.[column], editor.formatFor(column)));

	function insert() {
		if (editor.insertPlaceholder(column)) return;
		navigator.clipboard.writeText(`{{${column}}}`);
		toast.success(`Copied {{${column}}}`, {
			description: 'Paste it into a text or barcode field.'
		});
	}
</script>

<div
	class="group flex items-center gap-2 rounded-md py-1 pr-1 pl-2 transition-colors hover:bg-muted/60"
>
	<button
		class="shrink-0 cursor-pointer"
		onclick={insert}
		title={inUse ? 'Used in this template. Click to add again.' : 'Add to the selected element'}
	>
		<VarChip name={column} status={inUse ? 'detected' : 'idle'} class="hover:bg-accent" />
	</button>

	{#if sample}
		<!-- sits right beside the name; gives up space before the name does -->
		<span class="min-w-0 shrink truncate text-[11px] text-muted-foreground/70 tabular-nums">
			{sample}
		</span>
	{/if}

	<!-- formatting only matters for columns the template actually prints -->
	{#if inUse || customized}
		<Button
			variant="ghost"
			size="icon"
			class={cn('ml-auto size-6 shrink-0 cursor-pointer', customized && 'text-foreground')}
			title="Formatting"
			onclick={() => onformat(column)}
		>
			<SlidersHorizontalIcon class="size-3.5" />
			<span class="sr-only">Formatting for {column}</span>
		</Button>
	{/if}
</div>
