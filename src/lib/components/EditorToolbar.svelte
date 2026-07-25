<script lang="ts">
	import type { Component } from 'svelte';
	import { editor } from '$lib/template/editor.svelte';
	import type { AlignKind } from '$lib/template/geometry';
	import { Separator } from '$lib/components/ui/separator';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { buttonVariants } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import ToolButton from './ToolButton.svelte';
	import Undo2Icon from '@lucide/svelte/icons/undo-2';
	import Redo2Icon from '@lucide/svelte/icons/redo-2';
	import AlignStartVerticalIcon from '@lucide/svelte/icons/align-start-vertical';
	import AlignCenterVerticalIcon from '@lucide/svelte/icons/align-center-vertical';
	import AlignEndVerticalIcon from '@lucide/svelte/icons/align-end-vertical';
	import AlignStartHorizontalIcon from '@lucide/svelte/icons/align-start-horizontal';
	import AlignCenterHorizontalIcon from '@lucide/svelte/icons/align-center-horizontal';
	import AlignEndHorizontalIcon from '@lucide/svelte/icons/align-end-horizontal';
	import AlignHorizontalSpaceBetweenIcon from '@lucide/svelte/icons/align-horizontal-space-between';
	import AlignVerticalSpaceBetweenIcon from '@lucide/svelte/icons/align-vertical-space-between';
	import GroupIcon from '@lucide/svelte/icons/group';
	import UngroupIcon from '@lucide/svelte/icons/ungroup';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';

	const n = $derived(editor.selectedIds.length);
	// arrange acts on units (a group counts once), so gate on those, not elements
	const units = $derived(editor.unitCount);

	const alignItems: { kind: AlignKind; label: string; Icon: Component }[] = [
		{ kind: 'left', label: 'Align left', Icon: AlignStartVerticalIcon },
		{ kind: 'centerX', label: 'Align center', Icon: AlignCenterVerticalIcon },
		{ kind: 'right', label: 'Align right', Icon: AlignEndVerticalIcon },
		{ kind: 'top', label: 'Align top', Icon: AlignStartHorizontalIcon },
		{ kind: 'centerY', label: 'Align middle', Icon: AlignCenterHorizontalIcon },
		{ kind: 'bottom', label: 'Align bottom', Icon: AlignEndHorizontalIcon }
	];

	const menuTrigger = cn(
		buttonVariants({ variant: 'ghost', size: 'sm' }),
		'h-8 gap-1 px-2 text-xs'
	);
</script>

<div class="flex flex-col items-center gap-1.5">
	<div class="flex flex-wrap items-center gap-0.5 tool-surface p-1">
		<ToolButton
			label="Undo (Ctrl+Z)"
			icon={Undo2Icon}
			onclick={() => editor.undo()}
			disabled={!editor.canUndo}
		/>
		<ToolButton
			label="Redo (Ctrl+Shift+Z)"
			icon={Redo2Icon}
			onclick={() => editor.redo()}
			disabled={!editor.canRedo}
		/>

		{#if n > 0}
			<Separator orientation="vertical" class="mx-1 h-5" />

			<DropdownMenu.Root>
				<DropdownMenu.Trigger class={menuTrigger}>
					<AlignStartVerticalIcon class="size-4" />
					<span class="hidden sm:inline">Align</span>
					<ChevronDownIcon class="size-3 text-muted-foreground" />
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="start" class="min-w-56">
					<DropdownMenu.Label class="text-xs">
						{units === 1 ? 'Align to label' : 'Align to selection'}
					</DropdownMenu.Label>
					{#each alignItems as a (a.kind)}
						<DropdownMenu.Item onclick={() => editor.align(a.kind)}>
							<a.Icon class="size-4" />
							{a.label}
						</DropdownMenu.Item>
					{/each}
					<DropdownMenu.Separator />
					<DropdownMenu.Item disabled={units < 3} onclick={() => editor.distribute('x')}>
						<AlignHorizontalSpaceBetweenIcon class="size-4" /> Distribute horizontally
					</DropdownMenu.Item>
					<DropdownMenu.Item disabled={units < 3} onclick={() => editor.distribute('y')}>
						<AlignVerticalSpaceBetweenIcon class="size-4" /> Distribute vertically
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>

			<DropdownMenu.Root>
				<DropdownMenu.Trigger class={menuTrigger}>
					<GroupIcon class="size-4" />
					<span class="hidden sm:inline">Group</span>
					<ChevronDownIcon class="size-3 text-muted-foreground" />
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="start" class="min-w-56">
					<DropdownMenu.Item
						disabled={n < 2 || editor.selectionGrouped}
						onclick={() => editor.groupSelection()}
					>
						<GroupIcon class="size-4" /> Group
						<DropdownMenu.Shortcut>Ctrl+G</DropdownMenu.Shortcut>
					</DropdownMenu.Item>
					<DropdownMenu.Item
						disabled={!editor.selectedElements.some((e) => e.groupId)}
						onclick={() => editor.ungroupSelection()}
					>
						<UngroupIcon class="size-4" /> Ungroup
						<DropdownMenu.Shortcut>Ctrl+Shift+G</DropdownMenu.Shortcut>
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>

			<Separator orientation="vertical" class="mx-1 h-5" />
			<ToolButton
				label="Duplicate (Ctrl+D)"
				icon={CopyIcon}
				onclick={() => editor.duplicateSelection()}
			/>
			<ToolButton label="Delete (Del)" icon={Trash2Icon} onclick={() => editor.remove()} />
		{/if}
	</div>

	<!-- the count is status, not a control: its own smaller pill below -->
	{#if n > 0}
		<div
			class="hidden tool-surface px-2 py-0.5 text-[11px] whitespace-nowrap text-muted-foreground lg:block"
		>
			{n}
			{n === 1 ? 'element' : 'elements'} selected
		</div>
	{/if}
</div>
