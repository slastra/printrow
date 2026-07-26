<script lang="ts">
	import { editor } from '$lib/template/editor.svelte';
	import { useSidebar } from '$lib/components/ui/sidebar';

	/**
	 * Opens the sidebar when the canvas asks to edit an element.
	 *
	 * Renders nothing. It exists as a component only because `useSidebar()` has
	 * to run inside the provider, and it sits in the inset rather than in the
	 * sidebar itself: on mobile the sidebar is a Sheet that unmounts when
	 * closed, so a watcher living inside it could never see the request that
	 * was supposed to open it.
	 */
	const sidebar = useSidebar();

	// tracked per-consumer, so this never depends on another effect's ordering
	let seen = 0;

	$effect(() => {
		const req = editor.editRequest;
		if (!req || req.nonce === seen) return;
		seen = req.nonce;
		if (!sidebar.open) sidebar.setOpen(true);
	});
</script>
