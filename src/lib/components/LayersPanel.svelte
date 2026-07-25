<script lang="ts">
	import { dndzone, type DndEvent } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';
	import { editor } from '$lib/template/editor.svelte';
	import { ELEMENT_META } from '$lib/template/elements';
	import { splitVars } from '$lib/template/vars';
	import { data } from '$lib/template/data.svelte';
	import VarChip from './VarChip.svelte';
	import { cn } from '$lib/utils';
	import type { AnyElement } from '$lib/template/schema';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';

	interface Item {
		id: string;
		el: AnyElement;
	}

	const FLIP_MS = 150;

	// The dnd zone owns the order mid-gesture; the model owns it otherwise.
	// Non-null only while a drag is in flight.
	let dragItems = $state<Item[] | null>(null);
	const items = $derived(
		dragItems ?? [...editor.template.elements].reverse().map((el) => ({ id: el.id, el }))
	);

	function onConsider(e: CustomEvent<DndEvent<Item>>) {
		dragItems = e.detail.items;
	}

	function onFinalize(e: CustomEvent<DndEvent<Item>>) {
		editor.setOrder(e.detail.items.map((i) => i.id));
		dragItems = null;
	}

	// same modifier semantics as canvas clicks
	const isToggle = (e: MouseEvent | KeyboardEvent) => e.shiftKey || e.ctrlKey || e.metaKey;
</script>

{#if items.length === 0}
	<p class="px-2 py-1.5 text-xs text-muted-foreground">No elements yet. Add one below.</p>
{:else}
	<div
		class="space-y-0.5"
		use:dndzone={{ items, flipDurationMs: FLIP_MS, dropTargetStyle: {} }}
		onconsider={onConsider}
		onfinalize={onFinalize}
	>
		{#each items as item (item.id)}
			{@const meta = ELEMENT_META[item.el.type]}
			{@const Icon = meta.icon}
			{@const content = meta.content?.(item.el) ?? ''}
			<div
				animate:flip={{ duration: FLIP_MS }}
				role="button"
				tabindex="0"
				class="flex w-full cursor-grab items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs select-none active:cursor-grabbing
					{editor.selectedIds.includes(item.id) ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}"
				onclick={(e) => editor.select(item.id, { toggle: isToggle(e) })}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						editor.select(item.id, { toggle: isToggle(e) });
					}
				}}
			>
				<GripVerticalIcon class="size-3.5 shrink-0 text-muted-foreground/50" />
				{#if item.el.groupId}
					<span class="h-3 w-0.5 shrink-0 rounded bg-ring" title="Grouped"></span>
				{/if}
				<Icon class="size-3.5 shrink-0 text-muted-foreground" />
				{#if content}
					<!-- Inline flow, not flex: the authored string's own spaces do the
					     spacing, and chips ride the text baseline via align-middle. -->
					<span class="min-w-0 truncate">
						{#each splitVars(content) as part, i (i)}{#if part.isVar}<VarChip
									name={part.text}
									status={data.varStatus(part.text)}
									inline
								/>{:else}<span class="align-middle whitespace-pre">{part.text}</span>{/if}{/each}
					</span>
				{:else}
					<span class="truncate">{meta.label?.(item.el) ?? meta.name}</span>
				{/if}
			</div>
		{/each}
	</div>
{/if}
