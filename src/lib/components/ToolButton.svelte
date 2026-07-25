<script lang="ts">
	import type { Component } from 'svelte';
	import { buttonVariants } from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { cn } from '$lib/utils';

	let {
		label,
		icon: Icon,
		onclick,
		disabled = false,
		size = 'size-8'
	}: {
		label: string;
		icon: Component;
		onclick: () => void;
		disabled?: boolean;
		size?: string;
	} = $props();
</script>

<Tooltip.Root>
	<Tooltip.Trigger
		class={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), size)}
		{disabled}
		{onclick}
	>
		<Icon class="size-4" />
		<span class="sr-only">{label}</span>
	</Tooltip.Trigger>
	<Tooltip.Content>{label}</Tooltip.Content>
</Tooltip.Root>
