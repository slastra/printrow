<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { editor } from '$lib/template/editor.svelte';
	import { data } from '$lib/template/data.svelte';
	import { DEFAULT_FORMAT, formatValue } from '$lib/template/vars';
	import type { ColumnFormat } from '$lib/template/schema';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import * as Popover from '$lib/components/ui/popover';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import { cn } from '$lib/utils';
	import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';

	let { column, inUse }: { column: string; inUse: boolean } = $props();

	const fmt = $derived<ColumnFormat>(editor.template.formats[column] ?? DEFAULT_FORMAT);
	const customized = $derived(Boolean(editor.template.formats[column]));
	const sample = $derived(formatValue(data.previewRow?.[column], fmt));

	function insert() {
		if (editor.insertPlaceholder(column)) return;
		navigator.clipboard.writeText(`{{${column}}}`);
		toast.success(`Copied {{${column}}}`, {
			description: 'Paste it into a text or barcode field.'
		});
	}
</script>

<div
	class="group flex items-center gap-2 rounded-md py-1 pr-1 pl-2 transition-colors hover:bg-muted/60"
>
	<!-- in-use dot: filled when the template references this column -->
	<span
		class={cn('size-1.5 shrink-0 rounded-full', inUse ? 'bg-foreground' : 'bg-border')}
		title={inUse ? 'Used in this template' : 'Not used yet'}
	></span>

	<button
		class={cn(
			'shrink-0 truncate text-left font-mono text-xs',
			inUse ? 'text-foreground' : 'text-muted-foreground'
		)}
		onclick={insert}
		title="Add to the selected element"
	>
		{column}
	</button>

	{#if sample}
		<!-- sits right beside the name; gives up space before the name does -->
		<span class="min-w-0 shrink truncate text-[11px] text-muted-foreground/70 tabular-nums">
			{sample}
		</span>
	{/if}

	<Button
		variant="ghost"
		size="icon"
		class="ml-auto size-6 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
		onclick={insert}
		title="Add to the selected element"
	>
		<PlusIcon class="size-3.5" />
	</Button>

	<Popover.Root>
		<Popover.Trigger
			class={cn(
				buttonVariants({ variant: 'ghost', size: 'icon' }),
				'size-6 shrink-0',
				customized
					? 'text-foreground'
					: 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
			)}
			title="Formatting"
		>
			<SlidersHorizontalIcon class="size-3.5" />
		</Popover.Trigger>
		<Popover.Content class="w-64 space-y-3" align="end" side="left">
			<div class="flex items-center justify-between">
				<p class="font-mono text-xs">{column}</p>
				{#if customized}
					<Button
						variant="ghost"
						size="icon"
						class="size-6"
						title="Reset formatting"
						onclick={() => editor.resetFormat(column)}
					>
						<RotateCcwIcon class="size-3.5" />
					</Button>
				{/if}
			</div>

			<div class="space-y-1.5">
				<Label class="text-xs">Case</Label>
				<ToggleGroup.Root
					type="single"
					variant="outline"
					size="sm"
					value={fmt.transform}
					onValueChange={(v) =>
						editor.setFormat(column, {
							transform: (v || 'none') as ColumnFormat['transform']
						})}
					class="w-full"
				>
					<ToggleGroup.Item value="none" class="flex-1 text-xs">Aa</ToggleGroup.Item>
					<ToggleGroup.Item value="upper" class="flex-1 text-xs">AA</ToggleGroup.Item>
					<ToggleGroup.Item value="lower" class="flex-1 text-xs">aa</ToggleGroup.Item>
					<ToggleGroup.Item value="title" class="flex-1 text-xs">Ab</ToggleGroup.Item>
				</ToggleGroup.Root>
			</div>

			<div class="grid grid-cols-2 gap-2">
				<div class="space-y-1.5">
					<Label for="pre-{column}" class="text-xs">Prefix</Label>
					<Input
						id="pre-{column}"
						class="h-8 text-xs"
						placeholder="$"
						value={fmt.prefix}
						oninput={(e) => editor.setFormat(column, { prefix: e.currentTarget.value })}
					/>
				</div>
				<div class="space-y-1.5">
					<Label for="suf-{column}" class="text-xs">Suffix</Label>
					<Input
						id="suf-{column}"
						class="h-8 text-xs"
						placeholder="kg"
						value={fmt.suffix}
						oninput={(e) => editor.setFormat(column, { suffix: e.currentTarget.value })}
					/>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-2">
				<div class="space-y-1.5">
					<Label for="dec-{column}" class="text-xs">Decimals</Label>
					<Input
						id="dec-{column}"
						type="number"
						min="0"
						max="6"
						class="h-8 text-xs"
						placeholder="auto"
						value={fmt.decimals ?? ''}
						oninput={(e) => {
							const raw = e.currentTarget.value;
							editor.setFormat(column, { decimals: raw === '' ? null : Number(raw) });
						}}
					/>
				</div>
				<div class="space-y-1.5">
					<Label for="tho-{column}" class="text-xs">Max length</Label>
					<Input
						id="tho-{column}"
						type="number"
						min="0"
						max="200"
						class="h-8 text-xs"
						placeholder="none"
						value={fmt.maxChars || ''}
						oninput={(e) =>
							editor.setFormat(column, { maxChars: Number(e.currentTarget.value) || 0 })}
					/>
				</div>
			</div>

			<div class="flex items-center justify-between">
				<Label for="grp-{column}" class="text-xs">Thousands separator</Label>
				<Switch
					id="grp-{column}"
					checked={fmt.thousands}
					onCheckedChange={(v) => editor.setFormat(column, { thousands: v })}
				/>
			</div>

			{#if data.previewRow}
				<div class="rounded-md border bg-muted/40 px-2 py-1.5">
					<p class="text-[11px] text-muted-foreground">Preview</p>
					<p class="truncate text-xs">{sample || '(empty)'}</p>
				</div>
			{/if}
		</Popover.Content>
	</Popover.Root>
</div>
