<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from '$lib/components/ui/sonner';
	import * as Tooltip from '$lib/components/ui/tooltip';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<ModeWatcher defaultMode="dark" />
<Toaster position="bottom-right" />
<!-- one app-wide tooltip provider: shared delay + skip-delay state -->
<Tooltip.Provider delayDuration={300}>
	{@render children()}
</Tooltip.Provider>
