<script lang="ts">
	import { editor } from '$lib/template/editor.svelte';
	import { data } from '$lib/template/data.svelte';
	import { unknownVars } from '$lib/template/vars';
	import ColumnRow from './ColumnRow.svelte';
	import FormatDialog from './FormatDialog.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import XIcon from '@lucide/svelte/icons/x';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';

	const used = $derived(data.usedColumns);
	const unknown = $derived(unknownVars(editor.template, data.columns));

	let formatColumn = $state<string | null>(null);
</script>

<div class="space-y-3">
	<div class="flex items-center gap-2">
		<span class="truncate text-xs text-muted-foreground">
			{data.fileName} · {data.rows.length} rows
		</span>
		<Button variant="ghost" size="icon" class="ml-auto size-7" onclick={() => data.clear()}>
			<XIcon />
		</Button>
	</div>

	<div class="-mx-1 space-y-0.5">
		{#each data.columns as col (col)}
			<ColumnRow column={col} inUse={used.has(col)} onformat={(c) => (formatColumn = c)} />
		{/each}
	</div>
	<FormatDialog bind:column={formatColumn} />

	{#if unknown.length}
		<p class="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-500">
			<TriangleAlertIcon class="mt-px size-3.5 shrink-0" />
			<span>
				Bad variable {unknown.length > 1 ? 'names' : 'name'}: {unknown.join(', ')}
			</span>
		</p>
	{/if}

	<div class="flex items-center justify-between border-t pt-3">
		<div class="flex items-center gap-2">
			<Switch id="preview" checked={data.preview} onCheckedChange={(v) => (data.preview = v)} />
			<Label for="preview" class="text-xs">Preview data</Label>
		</div>
		<div class="flex items-center gap-1">
			<Button variant="ghost" size="icon" class="size-7" onclick={() => data.step(-1)}>
				<ChevronLeftIcon />
			</Button>
			<span class="text-xs text-muted-foreground tabular-nums">
				{data.previewIndex + 1}/{data.rows.length}
			</span>
			<Button variant="ghost" size="icon" class="size-7" onclick={() => data.step(1)}>
				<ChevronRightIcon />
			</Button>
		</div>
	</div>
</div>
