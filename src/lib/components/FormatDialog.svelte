<script lang="ts">
	import { editor } from '$lib/template/editor.svelte';
	import { data } from '$lib/template/data.svelte';
	import { DEFAULT_FORMAT, formatValue } from '$lib/template/vars';
	import {
		CURRENCIES,
		DATE_PATTERNS,
		type ColumnFormat,
		type Currency,
		type DatePattern
	} from '$lib/template/schema';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Select from '$lib/components/ui/select';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import { Separator } from '$lib/components/ui/separator';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import TypeIcon from '@lucide/svelte/icons/type';
	import HashIcon from '@lucide/svelte/icons/hash';
	import DollarSignIcon from '@lucide/svelte/icons/dollar-sign';
	import CalendarIcon from '@lucide/svelte/icons/calendar';

	let { column = $bindable(null) }: { column?: string | null } = $props();

	const open = $derived(column !== null);
	const fmt = $derived<ColumnFormat>((column && editor.template.formats[column]) || DEFAULT_FORMAT);
	const customized = $derived(Boolean(column && editor.template.formats[column]));

	// live sample across a few rows so the effect is obvious, not a single guess
	const samples = $derived.by(() => {
		const col = column;
		if (!col) return [];
		return data.rows
			.slice(data.previewIndex, data.previewIndex + 3)
			.map((r) => ({ raw: r[col] ?? '', out: formatValue(r[col], fmt) }));
	});

	const kinds = [
		{ value: 'text', label: 'Text', Icon: TypeIcon },
		{ value: 'number', label: 'Number', Icon: HashIcon },
		{ value: 'currency', label: 'Currency', Icon: DollarSignIcon },
		{ value: 'date', label: 'Date', Icon: CalendarIcon }
	] as const;

	function set(patch: Partial<ColumnFormat>) {
		if (column) editor.setFormat(column, patch);
	}
</script>

<Dialog.Root
	{open}
	onOpenChange={(v) => {
		if (!v) column = null;
	}}
>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				Format
				<code class="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">{column}</code>
			</Dialog.Title>
			<Dialog.Description>
				Applies everywhere this column is printed, and survives re-importing the CSV.
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4">
			<div class="space-y-1.5">
				<Label class="text-xs">Treat as</Label>
				<ToggleGroup.Root
					type="single"
					variant="outline"
					value={fmt.kind}
					onValueChange={(v) => v && set({ kind: v as ColumnFormat['kind'] })}
					class="w-full"
				>
					{#each kinds as k (k.value)}
						<ToggleGroup.Item value={k.value} class="flex-1 gap-1.5 text-xs">
							<k.Icon class="size-3.5" />
							{k.label}
						</ToggleGroup.Item>
					{/each}
				</ToggleGroup.Root>
			</div>

			{#if fmt.kind === 'currency'}
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1.5">
						<Label class="text-xs">Currency</Label>
						<Select.Root
							type="single"
							value={fmt.currency}
							onValueChange={(v) => v && set({ currency: v as Currency })}
						>
							<Select.Trigger class="w-full">{fmt.currency}</Select.Trigger>
							<Select.Content>
								{#each CURRENCIES as c (c)}
									<Select.Item value={c}>{c}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
					<div class="space-y-1.5">
						<Label for="fmt-dec" class="text-xs">Decimals</Label>
						<Input
							id="fmt-dec"
							type="number"
							min="0"
							max="6"
							placeholder="auto"
							value={fmt.decimals ?? ''}
							oninput={(e) =>
								set({ decimals: e.currentTarget.value === '' ? null : +e.currentTarget.value })}
						/>
					</div>
				</div>
				<div class="flex items-center justify-between">
					<Label for="fmt-code" class="text-xs">Show code instead of symbol</Label>
					<Switch
						id="fmt-code"
						checked={fmt.currencyCode}
						onCheckedChange={(v) => set({ currencyCode: v })}
					/>
				</div>
			{/if}

			{#if fmt.kind === 'number'}
				<div class="space-y-1.5">
					<Label for="fmt-dec-n" class="text-xs">Decimals</Label>
					<Input
						id="fmt-dec-n"
						type="number"
						min="0"
						max="6"
						placeholder="as written"
						value={fmt.decimals ?? ''}
						oninput={(e) =>
							set({ decimals: e.currentTarget.value === '' ? null : +e.currentTarget.value })}
					/>
				</div>
			{/if}

			{#if fmt.kind === 'number' || fmt.kind === 'currency'}
				<div class="flex items-center justify-between">
					<Label for="fmt-thou" class="text-xs">Thousands separator</Label>
					<Switch
						id="fmt-thou"
						checked={fmt.thousands}
						onCheckedChange={(v) => set({ thousands: v })}
					/>
				</div>
			{/if}

			{#if fmt.kind === 'date'}
				<div class="space-y-1.5">
					<Label class="text-xs">Pattern</Label>
					<Select.Root
						type="single"
						value={fmt.datePattern}
						onValueChange={(v) => v && set({ datePattern: v as DatePattern })}
					>
						<Select.Trigger class="w-full">
							{DATE_PATTERNS.find((p) => p.value === fmt.datePattern)?.example}
						</Select.Trigger>
						<Select.Content>
							{#each DATE_PATTERNS as p (p.value)}
								<Select.Item value={p.value}>
									<span class="flex w-full items-center justify-between gap-4">
										<span>{p.label}</span>
										<span class="text-xs text-muted-foreground">{p.example}</span>
									</span>
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
			{/if}

			{#if fmt.kind === 'text'}
				<div class="space-y-1.5">
					<Label class="text-xs">Case</Label>
					<ToggleGroup.Root
						type="single"
						variant="outline"
						value={fmt.transform}
						onValueChange={(v) => set({ transform: (v || 'none') as ColumnFormat['transform'] })}
						class="w-full"
					>
						<ToggleGroup.Item value="none" class="flex-1 text-xs">Aa</ToggleGroup.Item>
						<ToggleGroup.Item value="upper" class="flex-1 text-xs">AA</ToggleGroup.Item>
						<ToggleGroup.Item value="lower" class="flex-1 text-xs">aa</ToggleGroup.Item>
						<ToggleGroup.Item value="title" class="flex-1 text-xs">Ab</ToggleGroup.Item>
					</ToggleGroup.Root>
				</div>
			{/if}

			<Separator />

			<div class="grid grid-cols-3 gap-3">
				<div class="space-y-1.5">
					<Label for="fmt-pre" class="text-xs">Prefix</Label>
					<Input
						id="fmt-pre"
						placeholder="SKU-"
						value={fmt.prefix}
						oninput={(e) => set({ prefix: e.currentTarget.value })}
					/>
				</div>
				<div class="space-y-1.5">
					<Label for="fmt-suf" class="text-xs">Suffix</Label>
					<Input
						id="fmt-suf"
						placeholder=" ea"
						value={fmt.suffix}
						oninput={(e) => set({ suffix: e.currentTarget.value })}
					/>
				</div>
				<div class="space-y-1.5">
					<Label for="fmt-max" class="text-xs">Max length</Label>
					<Input
						id="fmt-max"
						type="number"
						min="0"
						max="200"
						placeholder="none"
						value={fmt.maxChars || ''}
						oninput={(e) => set({ maxChars: +e.currentTarget.value || 0 })}
					/>
				</div>
			</div>

			{#if samples.length}
				<div class="space-y-1 rounded-md border bg-muted/40 p-2.5">
					<p class="text-[11px] text-muted-foreground">Preview</p>
					{#each samples as s (s.raw)}
						<div class="flex items-center gap-2 text-xs">
							<span class="min-w-0 flex-1 truncate text-muted-foreground/70 line-through">
								{s.raw || '(empty)'}
							</span>
							<span class="min-w-0 flex-1 truncate font-medium">{s.out || '(empty)'}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<Dialog.Footer class="sm:justify-between">
			<Button
				variant="ghost"
				size="sm"
				disabled={!customized}
				onclick={() => column && editor.resetFormat(column)}
			>
				<RotateCcwIcon /> Reset
			</Button>
			<Button size="sm" onclick={() => (column = null)}>Done</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
