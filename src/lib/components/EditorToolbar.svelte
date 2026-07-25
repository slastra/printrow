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
	import BringToFrontIcon from '@lucide/svelte/icons/bring-to-front';
	import SendToBackIcon from '@lucide/svelte/icons/send-to-back';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';

	const n = $derived(editor.selectedIds.length);

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

<div class="flex flex-wrap items-center gap-0.5 rounded-md border bg-card p-1 shadow-md">
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
				<AlignStartVerticalIcon class="size-4" /> Align
				<ChevronDownIcon class="size-3 text-muted-foreground" />
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="start" class="min-w-56">
				<DropdownMenu.Label class="text-xs">
					{n === 1 ? 'Align to label' : 'Align to selection'}
				</DropdownMenu.Label>
				{#each alignItems as a (a.kind)}
					<DropdownMenu.Item onclick={() => editor.align(a.kind)}>
						<a.Icon class="size-4" />
						{a.label}
					</DropdownMenu.Item>
				{/each}
				<DropdownMenu.Separator />
				<DropdownMenu.Item disabled={n < 3} onclick={() => editor.distribute('x')}>
					<AlignHorizontalSpaceBetweenIcon class="size-4" /> Distribute horizontally
				</DropdownMenu.Item>
				<DropdownMenu.Item disabled={n < 3} onclick={() => editor.distribute('y')}>
					<AlignVerticalSpaceBetweenIcon class="size-4" /> Distribute vertically
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>

		<DropdownMenu.Root>
			<DropdownMenu.Trigger class={menuTrigger}>
				<LayersIcon class="size-4" /> Layer
				<ChevronDownIcon class="size-3 text-muted-foreground" />
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="start" class="min-w-56">
				<DropdownMenu.Item onclick={() => editor.bringToFront()}>
					<BringToFrontIcon class="size-4" /> Bring to front
				</DropdownMenu.Item>
				<DropdownMenu.Item onclick={() => editor.raise()}>
					<ChevronUpIcon class="size-4" /> Raise
					<DropdownMenu.Shortcut>]</DropdownMenu.Shortcut>
				</DropdownMenu.Item>
				<DropdownMenu.Item onclick={() => editor.lower()}>
					<ChevronDownIcon class="size-4" /> Lower
					<DropdownMenu.Shortcut>[</DropdownMenu.Shortcut>
				</DropdownMenu.Item>
				<DropdownMenu.Item onclick={() => editor.sendToBack()}>
					<SendToBackIcon class="size-4" /> Send to back
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>

		<DropdownMenu.Root>
			<DropdownMenu.Trigger class={menuTrigger}>
				<GroupIcon class="size-4" /> Group
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

		<Separator orientation="vertical" class="mx-1 h-5" />
		<span class="px-1.5 text-xs whitespace-nowrap text-muted-foreground">{n} selected</span>
	{/if}
</div>
