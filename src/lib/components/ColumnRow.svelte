<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { editor } from '$lib/template/editor.svelte';
	import { data } from '$lib/template/data.svelte';
	import { DEFAULT_FORMAT, formatValue } from '$lib/template/vars';
	import type { ColumnFormat } from '$lib/template/schema';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { badgeVariants } from '$lib/components/ui/badge';
	import { cn } from '$lib/utils';
	import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal';

	let {
		column,
		inUse,
		onformat
	}: { column: string; inUse: boolean; onformat: (column: string) => void } = $props();

	const fmt = $derived<ColumnFormat>(editor.template.formats[column] ?? DEFAULT_FORMAT);
	const customized = $derived(Boolean(editor.template.formats[column]));
	const sample = $derived(formatValue(data.previewRow?.[column], fmt));

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
	<!-- name badge with an in-use dot: emerald when the template references it -->
	<button
		class={cn(
			badgeVariants({ variant: inUse ? 'secondary' : 'outline' }),
			'shrink-0 cursor-pointer gap-1.5 font-mono hover:bg-accent',
			!inUse && 'text-muted-foreground'
		)}
		onclick={insert}
		title={inUse ? 'Used in this template. Click to add again.' : 'Add to the selected element'}
	>
		<span
			class={cn(
				'size-1.5 shrink-0 rounded-full',
				inUse ? 'bg-emerald-500' : 'bg-muted-foreground/40'
			)}
		></span>
		<span class="truncate">{column}</span>
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
		</Button>
	{/if}
</div>
