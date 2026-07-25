<script lang="ts">
	import type { Component } from 'svelte';
	import { editor } from '$lib/template/editor.svelte';
	import type { AlignKind } from '$lib/template/geometry';
	import { Separator } from '$lib/components/ui/separator';
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
	import CopyIcon from '@lucide/svelte/icons/copy';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';

	const n = $derived(editor.selectedIds.length);

	const alignButtons: { kind: AlignKind; label: string; Icon: Component }[] = [
		{ kind: 'left', label: 'Align left', Icon: AlignStartVerticalIcon },
		{ kind: 'centerX', label: 'Align center', Icon: AlignCenterVerticalIcon },
		{ kind: 'right', label: 'Align right', Icon: AlignEndVerticalIcon },
		{ kind: 'top', label: 'Align top', Icon: AlignStartHorizontalIcon },
		{ kind: 'centerY', label: 'Align middle', Icon: AlignCenterHorizontalIcon },
		{ kind: 'bottom', label: 'Align bottom', Icon: AlignEndHorizontalIcon }
	];
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
		{#each alignButtons as b (b.kind)}
			<ToolButton
				label={n === 1 ? `${b.label} (of label)` : b.label}
				icon={b.Icon}
				onclick={() => editor.align(b.kind)}
			/>
		{/each}
		<ToolButton
			label="Distribute horizontally"
			icon={AlignHorizontalSpaceBetweenIcon}
			onclick={() => editor.distribute('x')}
			disabled={n < 3}
		/>
		<ToolButton
			label="Distribute vertically"
			icon={AlignVerticalSpaceBetweenIcon}
			onclick={() => editor.distribute('y')}
			disabled={n < 3}
		/>

		<Separator orientation="vertical" class="mx-1 h-5" />
		{#if editor.selectionGrouped}
			<ToolButton
				label="Ungroup (Ctrl+Shift+G)"
				icon={UngroupIcon}
				onclick={() => editor.ungroupSelection()}
			/>
		{:else}
			<ToolButton
				label="Group (Ctrl+G)"
				icon={GroupIcon}
				onclick={() => editor.groupSelection()}
				disabled={n < 2}
			/>
		{/if}

		<Separator orientation="vertical" class="mx-1 h-5" />
		<ToolButton
			label="Bring to front"
			icon={BringToFrontIcon}
			onclick={() => editor.bringToFront()}
		/>
		<ToolButton label="Raise (])" icon={ChevronUpIcon} onclick={() => editor.raise()} />
		<ToolButton label="Lower ([)" icon={ChevronDownIcon} onclick={() => editor.lower()} />
		<ToolButton label="Send to back" icon={SendToBackIcon} onclick={() => editor.sendToBack()} />

		<Separator orientation="vertical" class="mx-1 h-5" />
		<ToolButton
			label="Duplicate (Ctrl+D)"
			icon={CopyIcon}
			onclick={() => editor.duplicateSelection()}
		/>
		<ToolButton label="Delete (Del)" icon={Trash2Icon} onclick={() => editor.remove()} />

		<span class="ml-auto pr-1 text-xs text-muted-foreground">{n} selected</span>
	{/if}
</div>
