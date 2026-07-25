<script lang="ts">
	import { printer } from '$lib/printer/ble.svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import CheckIcon from '@lucide/svelte/icons/check';
	import XIcon from '@lucide/svelte/icons/x';
	import InfoIcon from '@lucide/svelte/icons/info';
	import printerImage from '$lib/assets/printer.png';

	let open = $state(false);

	// Read live rather than at module load: the checks depend on the browser and
	// the origin, so a static list would lie to whoever most needs the truth.
	const checks = $derived([
		{
			ok: printer.hasBluetooth,
			label: 'Web Bluetooth',
			fix: 'Chromium only (Chrome, Edge, Opera). On Linux also enable chrome://flags/#enable-web-bluetooth and relaunch.'
		},
		{
			ok: printer.isSecure,
			label: 'Secure context',
			fix: 'Bluetooth needs https or localhost. On a plain http origin the printer cannot be reached at all.'
		}
	]);

	const ready = $derived(checks.every((c) => c.ok));
</script>

<Button variant="ghost" size="sm" class="justify-start gap-2" onclick={() => (open = true)}>
	<InfoIcon class="size-4" />
	<span>About</span>
</Button>

<Dialog.Root bind:open>
	<!-- tall content plus a short viewport (a phone, or a zoomed desktop) would
	     otherwise push the footer off-screen with no way to reach it -->
	<Dialog.Content class="max-h-[85svh] overflow-y-auto sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>About printrow</Dialog.Title>
			<Dialog.Description>
				A label designer that prints against CSV data over Web Bluetooth. No drivers, no installs,
				no print server.
			</Dialog.Description>
		</Dialog.Header>

		<img
			src={printerImage}
			alt="A KNAON Y50P thermal printer presenting a printed label that reads PRINTROW above a barcode"
			class="mx-auto w-44 max-w-full"
		/>

		<div class="space-y-3">
			<div class="space-y-1">
				<h3 class="text-sm font-medium">Supported printers</h3>
				<p class="text-xs text-muted-foreground">
					Verified on a <strong class="font-medium text-foreground">KNAON Y50P</strong> at 50 × 30 mm.
					The same hardware is white-labelled under other names, so the badge on the case is not the
					giveaway. If the vendor app pairs over Bluetooth and the printer takes 50 mm stock, it is
					worth a try.
				</p>
			</div>

			<Separator />

			<div class="space-y-2">
				<h3 class="text-sm font-medium">This browser</h3>
				{#each checks as c (c.label)}
					<div class="flex gap-2">
						{#if c.ok}
							<CheckIcon class="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
						{:else}
							<XIcon class="mt-0.5 size-3.5 shrink-0 text-red-500" />
						{/if}
						<div class="min-w-0 space-y-0.5">
							<p class="text-xs leading-tight font-medium">{c.label}</p>
							{#if !c.ok}
								<p class="text-xs leading-snug text-muted-foreground">{c.fix}</p>
							{/if}
						</div>
					</div>
				{/each}
				<p class="text-xs text-muted-foreground">
					{#if ready}
						Everything the printer needs is available here.
					{:else}
						Designing and exporting still work. Only printing is blocked.
					{/if}
				</p>
			</div>
		</div>

		<Dialog.Footer class="sm:justify-between">
			<a
				href="https://github.com/slastra/printrow"
				target="_blank"
				rel="noreferrer"
				class="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
			>
				Source and protocol notes on GitHub
			</a>
			<Button variant="outline" size="sm" onclick={() => (open = false)}>Close</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
