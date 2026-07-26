<script lang="ts">
	import { editor } from '$lib/template/editor.svelte';
	import {
		BARCODE_TYPES,
		MIN_FONT_SIZE,
		MAX_FONT_SIZE,
		MIN_THICKNESS,
		MAX_THICKNESS,
		MAX_RADIUS,
		MIN_STROKE,
		MAX_STROKE,
		BORDER_STYLES,
		FONTS,
		type FontKey,
		STOCK_COLORS,
		DOTS_PER_MM,
		type BorderStyle,
		type BarcodeType,
		type Ink
	} from '$lib/template/schema';
	import { rafThrottle, cn } from '$lib/utils';
	import IconPicker from './IconPicker.svelte';
	import MediaSelect from './MediaSelect.svelte';
	import { buttonVariants } from '$lib/components/ui/button';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Slider } from '$lib/components/ui/slider';
	import * as Select from '$lib/components/ui/select';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import BoldIcon from '@lucide/svelte/icons/bold';
	import ItalicIcon from '@lucide/svelte/icons/italic';
	import UnderlineIcon from '@lucide/svelte/icons/underline';
	import AlignLeftIcon from '@lucide/svelte/icons/align-left';
	import AlignCenterIcon from '@lucide/svelte/icons/align-center';
	import AlignRightIcon from '@lucide/svelte/icons/align-right';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';

	const el = $derived(editor.single);

	let textField = $state<HTMLTextAreaElement | null>(null);
	let dataField = $state<HTMLInputElement | null>(null);
	let iconPickerOpen = $state(false);

	/**
	 * Answer a canvas double-click by focusing the element's primary field.
	 *
	 * This re-runs rather than firing once, because the sidebar may still be
	 * opening when the request arrives: the field does not exist yet on the
	 * first pass, and clearing the request then would drop it on the floor.
	 * Types with nothing to type into clear it immediately — revealing the
	 * panel was the whole ask.
	 */
	let seenEdit = 0;

	$effect(() => {
		const req = editor.editRequest;
		if (!req || req.nonce === seenEdit || !el || el.id !== req.id) return;

		const grab = (node: HTMLTextAreaElement | HTMLInputElement | null) => {
			node?.focus();
			node?.select();
			return Boolean(node);
		};

		let handled: boolean;
		if (el.type === 'text') handled = grab(textField);
		else if (el.type === 'barcode') handled = grab(dataField);
		else if (el.type === 'icon') handled = iconPickerOpen = true;
		else handled = true;

		// only mark it seen once the field actually existed: on the first pass
		// the sidebar may still be opening and there is nothing to focus yet
		if (handled) seenEdit = req.nonce;
	});

	// sliders stream values while dragging; one model commit per frame is plenty
	const setFontSize = rafThrottle((v: number) => editor.update({ fontSize: v }));
	const setThickness = rafThrottle((v: number) => editor.update({ thickness: v }));
	const setRadius = rafThrottle((v: number) => editor.update({ radius: v }));
	const setStockRadius = rafThrottle((v: number) => editor.setStockRadius(v));
	const setStroke = rafThrottle((v: number) => editor.update({ strokeWidth: v }));

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

{#if editor.labelSelected}
	<div class="space-y-4">
		<div class="space-y-1.5">
			<Label>Stock colour</Label>
			<div class="flex flex-wrap gap-1.5">
				{#each STOCK_COLORS as c (c.value)}
					<button
						class="size-7 cursor-pointer rounded-md border transition-transform hover:scale-105
							{editor.template.stockColor === c.value ? 'border-ring ring-2 ring-ring/40' : 'border-border'}"
						style="background: {c.value}"
						title={c.label}
						aria-label={c.label}
						onclick={() => editor.setStockColor(c.value)}
					></button>
				{/each}
			</div>
		</div>

		<div class="space-y-2">
			<div class="flex items-center justify-between">
				<Label>Corner rounding</Label>
				<span class="text-xs text-muted-foreground tabular-nums">
					{editor.template.stockRadius === 0
						? 'square'
						: editor.template.stockRadius === 50
							? 'round'
							: `${editor.template.stockRadius}%`}
				</span>
			</div>
			<Slider
				type="single"
				value={editor.template.stockRadius}
				onValueChange={setStockRadius}
				min={0}
				max={50}
				step={1}
			/>
			<div class="flex gap-1">
				{#each [{ label: 'Square', pct: 0 }, { label: 'Rounded', pct: 8 }, { label: 'Round', pct: 50 }] as preset (preset.pct)}
					<Button
						variant={editor.template.stockRadius === preset.pct ? 'secondary' : 'ghost'}
						size="sm"
						class="flex-1 text-xs"
						onclick={() => editor.setStockRadius(preset.pct)}
					>
						{preset.label}
					</Button>
				{/each}
			</div>
		</div>

		<p class="text-xs text-muted-foreground">
			Colour and shape are preview only: they describe the stock in the printer. The head prints the
			same dots either way, so anything in a cut-away corner lands off the label.
		</p>

		<div class="space-y-1.5">
			<Label>Size</Label>
			<MediaSelect />
		</div>
	</div>
{:else if editor.selectedIds.length > 1}
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
				<Label>Font</Label>
				<Select.Root
					type="single"
					value={el.font}
					onValueChange={(v) => v && editor.update({ font: v as FontKey })}
				>
					<Select.Trigger class="w-full">
						{FONTS.find((f) => f.key === el.font)?.label}
					</Select.Trigger>
					<Select.Content>
						{#each FONTS as f (f.key)}
							<Select.Item value={f.key}>
								<span style="font-family: {f.stack}">{f.label}</span>
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<Label for="font-size">Font size</Label>
					<Input
						id="font-size"
						type="number"
						class="h-7 w-16 text-right text-xs"
						min={MIN_FONT_SIZE}
						max={MAX_FONT_SIZE}
						value={el.fontSize}
						oninput={(e) => editor.update({ fontSize: int(e.currentTarget.value, el.fontSize) })}
					/>
				</div>
				<Slider
					type="single"
					value={el.fontSize}
					onValueChange={setFontSize}
					min={MIN_FONT_SIZE}
					max={MAX_FONT_SIZE}
					step={1}
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
					bind:ref={dataField}
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
				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<Label>Border thickness</Label>
						<span class="text-xs text-muted-foreground tabular-nums">{el.thickness}</span>
					</div>
					<Slider
						type="single"
						value={el.thickness}
						onValueChange={setThickness}
						min={MIN_THICKNESS}
						max={MAX_THICKNESS}
						step={1}
					/>
				</div>
				<div class="space-y-1.5">
					<Label>Border style</Label>
					<Select.Root
						type="single"
						value={el.borderStyle}
						onValueChange={(v) => editor.update({ borderStyle: v as BorderStyle })}
					>
						<Select.Trigger class="w-full capitalize">{el.borderStyle}</Select.Trigger>
						<Select.Content>
							{#each BORDER_STYLES as style (style)}
								<Select.Item value={style} class="capitalize">{style}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
			{/if}
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<Label>Corner radius</Label>
					<span class="text-xs text-muted-foreground tabular-nums">{el.radius}</span>
				</div>
				<Slider
					type="single"
					value={el.radius}
					onValueChange={setRadius}
					min={0}
					max={MAX_RADIUS}
					step={1}
				/>
			</div>
		{:else if el.type === 'icon'}
			<div class="space-y-1.5">
				<Label>Icon</Label>
				<IconPicker
					bind:open={iconPickerOpen}
					selected={el.name}
					onselect={(name) => editor.update({ name })}
				>
					{#snippet trigger({ props })}
						<button
							{...props}
							class={cn(
								buttonVariants({ variant: 'outline' }),
								'w-full cursor-pointer justify-between overflow-hidden text-sm font-normal'
							)}
						>
							<span class="min-w-0 truncate first-letter:uppercase">
								{el.name.replace(/-/g, ' ')}
							</span>
							<ChevronDownIcon class="size-3.5 shrink-0 text-muted-foreground" />
						</button>
					{/snippet}
				</IconPicker>
			</div>
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<Label>Stroke weight</Label>
					<span class="text-xs text-muted-foreground tabular-nums">{el.strokeWidth}</span>
				</div>
				<Slider
					type="single"
					value={el.strokeWidth}
					onValueChange={setStroke}
					min={MIN_STROKE}
					max={MAX_STROKE}
					step={0.5}
				/>
				<p class="text-xs text-muted-foreground">
					Heavier strokes hold up better at small sizes on thermal paper.
				</p>
			</div>
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

		<div class="space-y-1.5">
			<Label>Ink</Label>
			<ToggleGroup.Root
				type="single"
				variant="outline"
				value={el.ink}
				onValueChange={(v) => v && editor.update({ ink: v as Ink })}
				class="w-full"
			>
				<!-- literal ink black, never a theme token: the swatch describes
				     what the head burns, which does not follow the UI theme.
				     Clear shows the loaded stock, because that is exactly what a
				     knockout reveals. -->
				<ToggleGroup.Item value="black" class="flex-1 gap-1.5 text-xs">
					<span class="size-3 rounded-full border border-border" style="background: #000"></span>
					Black
				</ToggleGroup.Item>
				<ToggleGroup.Item value="clear" class="flex-1 gap-1.5 text-xs">
					<span
						class="size-3 rounded-full border border-border"
						style="background: {editor.template.stockColor}"
					></span>
					Clear
				</ToggleGroup.Item>
			</ToggleGroup.Root>
			{#if el.ink === 'clear'}
				<p class="text-xs text-muted-foreground">
					Leaves the stock unburned, so keep it above a solid shape in the layer order. With nothing
					behind, it prints blank.
				</p>
			{/if}
		</div>

		<Button variant="destructive" class="w-full" onclick={() => editor.remove()}>
			<Trash2Icon /> Delete element
		</Button>
	</div>
{:else}
	<p class="text-sm text-muted-foreground">Select an element to edit its properties.</p>
{/if}
