<script lang="ts">
	import { editor } from '$lib/template/editor.svelte';
	import { ELEMENT_META } from '$lib/template/elements';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { Button } from '$lib/components/ui/button';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';

	// top of the list = frontmost, Canva-style
	const reversed = $derived([...editor.template.elements].reverse());

	// same modifier semantics as canvas clicks
	const isToggle = (e: MouseEvent | KeyboardEvent) => e.shiftKey || e.ctrlKey || e.metaKey;
</script>

{#if reversed.length === 0}
	<p class="text-sm text-muted-foreground">No elements yet — add one from the bar below.</p>
{:else}
	<ScrollArea class="max-h-72">
		<div class="space-y-0.5 pr-2">
			{#each reversed as el (el.id)}
				{@const meta = ELEMENT_META[el.type]}
				{@const Icon = meta.icon}
				<div
					role="button"
					tabindex="0"
					class="group flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs select-none
						{editor.selectedIds.includes(el.id) ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}"
					onclick={(e) => editor.select(el.id, { toggle: isToggle(e) })}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							editor.select(el.id, { toggle: isToggle(e) });
						}
					}}
				>
					{#if el.groupId}
						<span class="h-3 w-0.5 shrink-0 rounded bg-ring" title="Grouped"></span>
					{/if}
					<Icon class="size-3.5 shrink-0 text-muted-foreground" />
					<span class="truncate">{meta.label(el)}</span>
					<span class="ml-auto hidden shrink-0 gap-0.5 group-hover:flex">
						<Button
							variant="ghost"
							size="icon"
							class="size-5"
							onclick={(e) => {
								e.stopPropagation();
								editor.raise([el.id]);
							}}
						>
							<ChevronUpIcon class="size-3" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							class="size-5"
							onclick={(e) => {
								e.stopPropagation();
								editor.lower([el.id]);
							}}
						>
							<ChevronDownIcon class="size-3" />
						</Button>
					</span>
				</div>
			{/each}
		</div>
	</ScrollArea>
{/if}
