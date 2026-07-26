<script lang="ts">
	import { editor } from '$lib/template/editor.svelte';
	import { ELEMENT_META, type ElementKind } from '$lib/template/elements';
	import { pickFile, cn } from '$lib/utils';
	import { buttonVariants } from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import IconPicker from './IconPicker.svelte';
	import InsertFieldMenu from './InsertFieldMenu.svelte';
	import { data } from '$lib/template/data.svelte';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ToolButton from './ToolButton.svelte';

	// icon is inserted from the picker, so it isn't a plain tool button
	const kinds: ElementKind[] = ['text', 'barcode', 'image', 'rect'];
	// with a CSV loaded these two can be inserted already bound to a column,
	// which is the whole point of the app and was otherwise a four-step detour:
	// insert, select, find the field, type the braces by hand
	const BINDABLE = new Set<ElementKind>(['text', 'barcode']);
	const IconMark = ELEMENT_META.icon.icon;

	async function insert(kind: ElementKind) {
		if (kind === 'image') {
			const file = await pickFile('image/*');
			if (file) editor.addImageFromFile(file);
		} else {
			editor.add(kind);
		}
	}
</script>

<div class="flex items-center gap-0.5 tool-surface p-1">
	{#each kinds as kind (kind)}
		{#if data.loaded && BINDABLE.has(kind)}
			<InsertFieldMenu
				kind={kind as 'text' | 'barcode'}
				label={ELEMENT_META[kind].name}
				icon={ELEMENT_META[kind].icon}
			/>
		{:else}
			<ToolButton
				label={ELEMENT_META[kind].name}
				icon={ELEMENT_META[kind].icon}
				onclick={() => insert(kind)}
				size="size-9"
			/>
		{/if}
	{/each}
	<IconPicker onselect={(name) => editor.add('icon', { name })}>
		{#snippet trigger({ props })}
			<Tooltip.Root>
				<Tooltip.Trigger
					{...props}
					class={cn(
						buttonVariants({ variant: 'ghost', size: 'icon' }),
						// wider than the other tools: this one opens a picker
						// rather than inserting straight away, and the chevron
						// is what says so
						'h-9 w-auto gap-0.5 px-2 transition-transform active:scale-90'
					)}
				>
					<IconMark class="size-4" />
					<!-- the picker opens upward from the bottom bar, so the chevron
					     agrees with it -->
					<ChevronDownIcon class="size-3 rotate-180 text-muted-foreground" />
					<span class="sr-only">Icon</span>
				</Tooltip.Trigger>
				<Tooltip.Content side="top">Icon (browse)</Tooltip.Content>
			</Tooltip.Root>
		{/snippet}
	</IconPicker>
</div>
