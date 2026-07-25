<script lang="ts">
	import type { Snippet } from 'svelte';
	import { badgeVariants } from '$lib/components/ui/badge';
	import { cn } from '$lib/utils';
	import type { VarStatus } from '$lib/template/data.svelte';

	/**
	 * The one variable chip: a badge with a status dot. Used inline in layer
	 * rows and as a click target in the data panel, so both surfaces can never
	 * drift on what a status colour means.
	 */
	let {
		name,
		status,
		inline = false,
		class: className,
		...rest
	}: {
		name: string;
		status: VarStatus;
		/** ride the text baseline instead of sitting in a flex row */
		inline?: boolean;
		class?: string;
		[key: string]: unknown;
	} = $props();

	const DOT: Record<VarStatus, string> = {
		detected: 'bg-emerald-500',
		unknown: 'bg-amber-500',
		idle: 'bg-muted-foreground/40'
	};

	const TITLE: Record<VarStatus, string> = {
		detected: 'Matches a CSV column',
		unknown: 'No column with this name',
		idle: 'Import a CSV to bind this'
	};
</script>

<span
	class={cn(
		badgeVariants({ variant: status === 'detected' ? 'secondary' : 'outline' }),
		'gap-1.5 font-mono',
		status !== 'detected' && 'text-muted-foreground',
		inline && 'mx-px gap-1 py-0 align-middle text-[11px]',
		className
	)}
	title={TITLE[status]}
	{...rest}
>
	<span class={cn('size-1.5 shrink-0 rounded-full', DOT[status])}></span>
	<span class={inline ? undefined : 'truncate'}>{name}</span>
</span>
