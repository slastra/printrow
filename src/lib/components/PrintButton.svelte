<script lang="ts">
	import * as Popover from '$lib/components/ui/popover';
	import { buttonVariants } from '$lib/components/ui/button';
	import PrinterIcon from '@lucide/svelte/icons/printer';
	import { printer } from '$lib/printer/ble.svelte';
	import PrintPanel from './PrintPanel.svelte';
</script>

<Popover.Root>
	<Popover.Trigger class={buttonVariants({ variant: 'outline', size: 'sm' })}>
		<PrinterIcon />
		Print
		{#if printer.connected}
			<span class="size-2 rounded-full {printer.statusColor}"></span>
		{/if}
	</Popover.Trigger>
	<Popover.Content class="w-80" align="end">
		<PrintPanel />
	</Popover.Content>
</Popover.Root>
