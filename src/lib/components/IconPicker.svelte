<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Popover from '$lib/components/ui/popover';
	import * as Command from '$lib/components/ui/command';
	import { loadIcons, searchIcons, iconSvg, type IconEntry } from '$lib/template/icons';

	let {
		onselect,
		trigger,
		selected,
		open = $bindable(false)
	}: {
		onselect: (name: string) => void;
		trigger: Snippet<[{ props: Record<string, unknown> }]>;
		selected?: string;
		/** Bindable so a canvas double-click can open the search directly. */
		open?: boolean;
	} = $props();
	let query = $state('');
	let searchField = $state<HTMLInputElement | null>(null);
	let index = $state<IconEntry[]>([]);
	let loading = $state(false);

	// the whole set is a lazy chunk: nothing loads until the picker is opened
	$effect(() => {
		if (!open || index.length || loading) return;
		loading = true;
		loadIcons()
			.then((i) => (index = i))
			.finally(() => (loading = false));
	});

	const results = $derived(index.length ? searchIcons(index, query) : []);
	// currentColor, not black: tiles must follow the theme
	const preview = (svg: string) => iconSvg(svg, 2, 20, 'currentColor');

	function choose(name: string) {
		onselect(name);
		open = false;
		query = '';
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			{@render trigger({ props })}
		{/snippet}
	</Popover.Trigger>
	<Popover.Content
		class="w-72 p-0"
		align="start"
		onOpenAutoFocus={(e) => {
			// The popover's own autofocus lands on the content wrapper, leaving
			// the caret nowhere. Take it over and put it in the search box: the
			// only reason to open this is to look for an icon, and a canvas
			// double-click arrives here meaning exactly that.
			e.preventDefault();
			searchField?.focus();
		}}
	>
		<Command.Root shouldFilter={false}>
			<Command.Input placeholder="Search icons…" bind:value={query} bind:ref={searchField} />
			<Command.List class="max-h-72">
				{#if loading}
					<div class="py-6 text-center text-sm text-muted-foreground">Loading icons…</div>
				{:else if results.length === 0}
					<Command.Empty>No icon matches “{query}”.</Command.Empty>
				{:else}
					<!-- a grid, not rows: 2000 marks are scanned visually, not read -->
					<div class="grid grid-cols-6 gap-1 p-2">
						{#each results as entry (entry.name)}
							<button
								class="flex aspect-square cursor-pointer items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent
									{selected === entry.name ? 'bg-accent ring-1 ring-ring' : ''}"
								title={entry.name}
								aria-label={entry.name}
								onclick={() => choose(entry.name)}
							>
								<!-- markup comes from the lucide package, not user input -->
								{@html preview(entry.svg)}
							</button>
						{/each}
					</div>
					<p class="px-3 pb-2 text-[11px] text-muted-foreground">
						{results.length} shown{query ? '' : ' of ' + index.length}. Search by name or keyword.
					</p>
				{/if}
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
