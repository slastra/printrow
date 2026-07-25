<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { printer } from '$lib/printer/ble.svelte';
	import { cn } from '$lib/utils';
	import PrinterIcon from '@lucide/svelte/icons/printer';
	import PrintDialog from './PrintDialog.svelte';

	let open = $state(false);
</script>

<Button class="w-full justify-center gap-2" onclick={() => (open = true)}>
	<PrinterIcon />
	Print
	{#if printer.connected}
		<!-- connection is a quiet aside on the action, not the action itself -->
		<span class={cn('size-1.5 rounded-full', printer.statusColor)}></span>
	{/if}
</Button>

<PrintDialog bind:open />
