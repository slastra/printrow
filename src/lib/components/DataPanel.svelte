<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { editor } from '$lib/template/editor.svelte';
	import { data } from '$lib/template/data.svelte';
	import { extractVars } from '$lib/template/vars';
	import { cn } from '$lib/utils';
	import { Button } from '$lib/components/ui/button';
	import { Badge, badgeVariants } from '$lib/components/ui/badge';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import * as Select from '$lib/components/ui/select';
	import XIcon from '@lucide/svelte/icons/x';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';

	const vars = $derived(extractVars(editor.template));

	async function copyPlaceholder(col: string) {
		const placeholder = `{{${col}}}`;
		await navigator.clipboard.writeText(placeholder);
		toast.success(`Copied ${placeholder}`, {
			description: 'Paste it into a text or barcode data field.'
		});
	}
</script>

<div class="space-y-4">
	{#if data.loaded}
		<div class="flex items-center gap-2">
			<span class="truncate text-xs text-muted-foreground">
				{data.fileName} · {data.rows.length} rows
			</span>
			<Button variant="ghost" size="icon" class="ml-auto size-7" onclick={() => data.clear()}>
				<XIcon />
			</Button>
		</div>

		<!-- what the CSV offers — click a column to copy its placeholder -->
		<div class="space-y-1.5">
			<p class="text-xs text-muted-foreground">Available columns (click to copy):</p>
			<div class="flex flex-wrap gap-1">
				{#each data.columns as col (col)}
					<button
						class={cn(
							badgeVariants({ variant: 'outline' }),
							'cursor-pointer font-mono hover:bg-accent'
						)}
						onclick={() => copyPlaceholder(col)}
					>
						{'{{'}{col}{'}}'}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	{#if vars.length > 0}
		<div class="space-y-2">
			{#each vars as v (v)}
				<div class="flex items-center gap-2">
					<Badge variant="secondary" class="shrink-0 font-mono">{'{{'}{v}{'}}'}</Badge>
					{#if data.loaded}
						<Select.Root
							type="single"
							value={editor.template.mapping[v] ?? ''}
							onValueChange={(col) => editor.setMapping(v, col)}
						>
							<Select.Trigger class="h-8 w-full text-xs">
								{editor.template.mapping[v] ?? 'choose column…'}
							</Select.Trigger>
							<Select.Content>
								{#each data.columns as col (col)}
									<Select.Item value={col}>{col}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					{:else}
						<span class="text-xs text-muted-foreground">import a CSV to map</span>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	{#if data.loaded}
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
	{/if}
</div>
