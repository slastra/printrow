<script lang="ts">
	import { editor } from '$lib/template/editor.svelte';
	import {
		BARCODE_TYPES,
		MIN_FONT_SIZE,
		MAX_FONT_SIZE,
		type BarcodeType
	} from '$lib/template/schema';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Select from '$lib/components/ui/select';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import BoldIcon from '@lucide/svelte/icons/bold';
	import ItalicIcon from '@lucide/svelte/icons/italic';
	import UnderlineIcon from '@lucide/svelte/icons/underline';
	import AlignLeftIcon from '@lucide/svelte/icons/align-left';
	import AlignCenterIcon from '@lucide/svelte/icons/align-center';
	import AlignRightIcon from '@lucide/svelte/icons/align-right';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';

	const el = $derived(editor.single);

	let textField = $state<HTMLTextAreaElement | null>(null);

	// canvas double-click on a text element lands here
	$effect(() => {
		if (editor.textEditRequest && textField) {
			textField.focus();
			textField.select();
			editor.textEditRequest = null;
		}
	});

	function int(value: string, fallback: number): number {
		const n = Math.round(Number(value));
		return Number.isFinite(n) ? n : fallback;
	}

	const aligns = [
		{ value: 'left', icon: AlignLeftIcon },
		{ value: 'center', icon: AlignCenterIcon },
		{ value: 'right', icon: AlignRightIcon }
	] as const;
</script>

{#if editor.selectedIds.length > 1}
	<div class="space-y-3">
		<p class="text-sm text-muted-foreground">{editor.selectedIds.length} elements selected.</p>
		<p class="text-xs text-muted-foreground">
			Use the toolbar above the canvas to align, distribute, group, and reorder.
		</p>
		<Button variant="destructive" class="w-full" onclick={() => editor.remove()}>
			<Trash2Icon /> Delete elements
		</Button>
	</div>
{:else if el}
	<div class="space-y-4">
		{#if el.type === 'text'}
			<div class="space-y-1.5">
				<Label for="el-text">Text</Label>
				<Textarea
					id="el-text"
					bind:ref={textField}
					rows={3}
					placeholder={'{{name}}'}
					value={el.text}
					oninput={(e) => editor.update({ text: e.currentTarget.value })}
				/>
				<p class="text-xs text-muted-foreground">Supports {'{{var}}'} placeholders.</p>
			</div>
			<div class="space-y-1.5">
				<Label for="font-size">Font size</Label>
				<Input
					id="font-size"
					type="number"
					min={MIN_FONT_SIZE}
					max={MAX_FONT_SIZE}
					value={el.fontSize}
					oninput={(e) => editor.update({ fontSize: int(e.currentTarget.value, el.fontSize) })}
				/>
			</div>
			<div class="space-y-1.5">
				<Label>Style</Label>
				<ToggleGroup.Root
					type="multiple"
					variant="outline"
					value={[el.bold && 'bold', el.italic && 'italic', el.underline && 'underline'].filter(
						(s): s is string => Boolean(s)
					)}
					onValueChange={(v) =>
						editor.update({
							bold: v.includes('bold'),
							italic: v.includes('italic'),
							underline: v.includes('underline')
						})}
				>
					<ToggleGroup.Item value="bold" aria-label="Bold"><BoldIcon /></ToggleGroup.Item>
					<ToggleGroup.Item value="italic" aria-label="Italic"><ItalicIcon /></ToggleGroup.Item>
					<ToggleGroup.Item value="underline" aria-label="Underline">
						<UnderlineIcon />
					</ToggleGroup.Item>
				</ToggleGroup.Root>
			</div>
			<div class="space-y-1.5">
				<Label>Align</Label>
				<div class="flex gap-1">
					{#each aligns as a (a.value)}
						<Button
							variant={el.align === a.value ? 'secondary' : 'ghost'}
							size="icon"
							onclick={() => editor.update({ align: a.value })}
						>
							<a.icon />
						</Button>
					{/each}
				</div>
			</div>
			<div class="flex items-center justify-between">
				<Label for="autofit">Shrink to fit</Label>
				<Switch
					id="autofit"
					checked={el.autoFit}
					onCheckedChange={(v) => editor.update({ autoFit: v })}
				/>
			</div>
		{:else if el.type === 'barcode'}
			<div class="space-y-1.5">
				<Label>Symbology</Label>
				<Select.Root
					type="single"
					value={el.bcid}
					onValueChange={(v) => editor.update({ bcid: v as BarcodeType })}
				>
					<Select.Trigger class="w-full">{el.bcid}</Select.Trigger>
					<Select.Content>
						{#each BARCODE_TYPES as t (t)}
							<Select.Item value={t}>{t}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
			<div class="space-y-1.5">
				<Label for="bc-data">Data</Label>
				<Input
					id="bc-data"
					value={el.data}
					placeholder={'{{code}}'}
					oninput={(e) => editor.update({ data: e.currentTarget.value })}
				/>
				<p class="text-xs text-muted-foreground">Supports {'{{var}}'} placeholders.</p>
			</div>
		{:else if el.type === 'rect'}
			<div class="flex items-center justify-between">
				<Label for="solid">Solid fill</Label>
				<Switch
					id="solid"
					checked={el.solid}
					onCheckedChange={(v) => editor.update({ solid: v })}
				/>
			</div>
			{#if !el.solid}
				<div class="space-y-1.5">
					<Label for="thickness">Border thickness</Label>
					<Input
						id="thickness"
						type="number"
						min="1"
						max="50"
						value={el.thickness}
						oninput={(e) => editor.update({ thickness: int(e.currentTarget.value, el.thickness) })}
					/>
				</div>
			{/if}
		{:else if el.type === 'image'}
			<div class="space-y-1.5">
				<Label>1-bit conversion</Label>
				<Select.Root
					type="single"
					value={el.mode}
					onValueChange={(v) => editor.update({ mode: v as 'threshold' | 'dither' })}
				>
					<Select.Trigger class="w-full"
						>{el.mode === 'dither' ? 'Dither (photos)' : 'Threshold (line art)'}</Select.Trigger
					>
					<Select.Content>
						<Select.Item value="threshold">Threshold (line art)</Select.Item>
						<Select.Item value="dither">Dither (photos)</Select.Item>
					</Select.Content>
				</Select.Root>
			</div>
		{/if}
		<Button variant="destructive" class="w-full" onclick={() => editor.remove()}>
			<Trash2Icon /> Delete element
		</Button>
	</div>
{:else}
	<p class="text-sm text-muted-foreground">Select an element to edit its properties.</p>
{/if}
