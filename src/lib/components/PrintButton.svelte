<script lang="ts">
	import { toast } from 'svelte-sonner';
	import * as Popover from '$lib/components/ui/popover';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import BluetoothIcon from '@lucide/svelte/icons/bluetooth';
	import BluetoothOffIcon from '@lucide/svelte/icons/bluetooth-off';
	import PrinterIcon from '@lucide/svelte/icons/printer';
	import { printer } from '$lib/printer/ble.svelte';
	import PrintPanel from './PrintPanel.svelte';

	let connecting = $state(false);

	async function connect() {
		if (!printer.supported) {
			toast.error('Web Bluetooth unavailable', {
				description:
					'On Linux enable chrome://flags/#enable-web-bluetooth and relaunch; needs localhost or https.'
			});
			return;
		}
		connecting = true;
		try {
			await printer.connect();
			toast.success(`Connected to ${printer.deviceName}`);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'connection failed');
		} finally {
			connecting = false;
		}
	}
</script>

{#if !printer.connected}
	<Button size="sm" class="w-full" disabled={connecting} onclick={connect}>
		<BluetoothIcon />
		{connecting ? 'Connecting…' : 'Connect'}
	</Button>
{:else}
	<div class="flex w-full">
		<Popover.Root>
			<Popover.Trigger
				class={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'flex-1 rounded-r-none')}
			>
				<span class="size-2 rounded-full {printer.statusColor}"></span>
				<PrinterIcon />
				Print
			</Popover.Trigger>
			<Popover.Content class="w-80" align="start">
				<PrintPanel />
			</Popover.Content>
		</Popover.Root>
		<Button
			size="sm"
			class="rounded-l-none border-l border-primary-foreground/25 px-2.5"
			title="Disconnect"
			onclick={() => printer.disconnect()}
		>
			<BluetoothOffIcon />
		</Button>
	</div>
{/if}
