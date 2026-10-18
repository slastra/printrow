<script lang="ts">
	import type { Component } from 'svelte';
	import { buttonVariants } from '#lib/components/ui/button/index.js';
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';
	import { cn } from '#lib/utils.js';

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
		class={cn(
			buttonVariants({ variant: 'ghost', size: 'icon' }),
			'transition-transform active:scale-90',
			size
		)}
		{disabled}
		{onclick}
	>
		<Icon class="size-4" />
		<span class="sr-only">{label}</span>
	</Tooltip.Trigger>
	<Tooltip.Content>{label}</Tooltip.Content>
</Tooltip.Root>
