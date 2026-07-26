<script lang="ts">
	import type { Component } from 'svelte';
	import { editor } from '$lib/template/editor.svelte';
	import { data } from '$lib/template/data.svelte';
	import { buttonVariants } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { cn } from '$lib/utils';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';

	let {
		kind,
		label,
		icon: Icon
	}: {
		kind: 'text' | 'barcode';
		label: string;
		icon: Component;
	} = $props();

	// text carries its placeholder in `text`, a barcode in `data` — the only
	// difference between the two, so one menu serves both
	const field = $derived(kind === 'text' ? 'text' : 'data');

	/** What the column holds right now, to tell similar-looking columns apart. */
	function sample(column: string): string {
		const v = data.rows[data.previewIndex]?.[column] ?? '';
		return v.length > 24 ? `${v.slice(0, 24)}…` : v;
	}
</script>

<DropdownMenu.Root>
	<!-- Trigger drawn directly rather than wrapped in a Tooltip.Trigger: two
	     trigger components fighting over one element leaves the menu unable to
	     open. `title` carries the hint instead. -->
	<DropdownMenu.Trigger
		title="{label} — insert bound to a column"
		class={cn(
			buttonVariants({ variant: 'ghost', size: 'icon' }),
			// wider than a plain tool, and the chevron says why: this one offers
			// the CSV columns rather than inserting straight away
			'h-9 w-auto gap-0.5 px-2 transition-transform active:scale-90'
		)}
	>
		<Icon class="size-4" />
		<!-- the menu opens upward from the bottom bar, so the chevron agrees -->
		<ChevronDownIcon class="size-3 rotate-180 text-muted-foreground" />
		<span class="sr-only">{label}</span>
	</DropdownMenu.Trigger>

	<DropdownMenu.Content side="top" align="center" class="max-h-80 w-64 overflow-y-auto">
		<DropdownMenu.Item onclick={() => editor.add(kind)}>
			Blank {label.toLowerCase()}
		</DropdownMenu.Item>
		<DropdownMenu.Separator />
		<!-- GroupHeading reads its label from Group context; bare, it throws and
		     takes the whole menu content down with it -->
		<DropdownMenu.Group>
			<DropdownMenu.GroupHeading class="text-xs">Bind to a column</DropdownMenu.GroupHeading>
			{#each data.columns as column (column)}
				<DropdownMenu.Item
					class="gap-2"
					onclick={() => editor.add(kind, { [field]: `{{${column}}}` })}
				>
					<span class="shrink-0 font-mono text-xs">{column}</span>
					<span class="min-w-0 flex-1 truncate text-right text-xs text-muted-foreground">
						{sample(column)}
					</span>
				</DropdownMenu.Item>
			{/each}
		</DropdownMenu.Group>
	</DropdownMenu.Content>
</DropdownMenu.Root>
