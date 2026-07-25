<script lang="ts">
	import { editor } from '$lib/template/editor.svelte';
	import { useSidebar } from '$lib/components/ui/sidebar';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import FileIcon from '@lucide/svelte/icons/file';

	// must run inside Sidebar.Provider, hence a child component rather than
	// calling useSidebar() from the page itself
	const sidebar = useSidebar();

	function openLabel() {
		editor.selectLabel();
		// the properties it just selected live in the sidebar, so a collapsed
		// sidebar would make this a no-op from the user's point of view
		if (!sidebar.open) sidebar.setOpen(true);
	}
</script>

<Tooltip.Root>
	<Tooltip.Trigger
		onclick={openLabel}
		class="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-border bg-(--surface-tool) text-muted-foreground shadow-(--shadow-tool) backdrop-blur-[10px] transition-colors hover:text-foreground
			{editor.labelSelected ? 'text-foreground ring-1 ring-ring' : ''}"
	>
		<FileIcon class="size-4" />
		<span class="sr-only">Label properties</span>
	</Tooltip.Trigger>
	<Tooltip.Content side="right">Label properties</Tooltip.Content>
</Tooltip.Root>
