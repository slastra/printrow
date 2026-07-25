<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import BluetoothIcon from '@lucide/svelte/icons/bluetooth';
	import BluetoothOffIcon from '@lucide/svelte/icons/bluetooth-off';
	import { printer } from '$lib/printer/ble.svelte';

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
		<Button
			size="sm"
			class="flex-1 justify-start truncate rounded-r-none font-mono"
			disabled={printer.busy}
			title="Refresh printer status"
			onclick={() => printer.readStatus()}
		>
			<BluetoothIcon />
			{printer.deviceName}
		</Button>
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
