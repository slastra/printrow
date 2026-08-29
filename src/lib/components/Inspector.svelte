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
		MIN_LINE_HEIGHT,
		MAX_LINE_HEIGHT,
		MIN_LETTER_SPACING,
		MAX_LETTER_SPACING,
		MIN_CUTOFF,
		MAX_CUTOFF,
		BORDER_STYLES,
		FONTS,
		type FontKey,
		type TextSizing,
		STOCK_COLORS,
		DOTS_PER_MM,
		type BorderStyle,
		type BarcodeType,
		type Ink
	} from '$lib/template/schema';
	import { THRESHOLD } from '$lib/template/nodes';
	import { rafThrottle, cn } from '$lib/utils';
	import {
		MODEL_LIST,
		printableWidthMm,
		type PrintDirection,
		type PrinterId
	} from '$lib/printer/models';
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
	import AlignStartHorizontalIcon from '@lucide/svelte/icons/align-start-horizontal';
	import AlignCenterHorizontalIcon from '@lucide/svelte/icons/align-center-horizontal';
	import AlignEndHorizontalIcon from '@lucide/svelte/icons/align-end-horizontal';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import PrinterIcon from '@lucide/svelte/icons/printer';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';

	const el = $derived(editor.single);

	let textField = $state<HTMLTextAreaElement | null>(null);
	let dataField = $state<HTMLInputElement | null>(null);
	let iconPickerOpen = $state(false);

	let seenEdit: { id: string } | null = null;

	/**
	 * Answer a canvas double-click by focusing the element's primary field.
	 *
	 * Re-runs rather than firing once: the sidebar may still be opening when
	 * the request arrives, so the field does not exist on the first pass. The
	 * request is only ticked off once there was actually a field to focus.
	 */
	$effect(() => {
		const req = editor.editRequest;
		if (!req || req === seenEdit || !el || el.id !== req.id) return;

		const grab = (node: HTMLTextAreaElement | HTMLInputElement | null) => {
			node?.focus();
			node?.select();
			return Boolean(node);
		};

		// image and rect have nothing to type into — revealing the panel was the
		// whole ask, so they are done the moment they arrive
		let handled = true;
		if (el.type === 'text') handled = grab(textField);
		else if (el.type === 'barcode') handled = grab(dataField);
		else if (el.type === 'icon') iconPickerOpen = true;

		if (handled) seenEdit = req;
	});

	// sliders stream values while dragging; one model commit per frame is plenty
	const setFontSize = rafThrottle((v: number) => editor.update({ fontSize: v }));
	const setThickness = rafThrottle((v: number) => editor.update({ thickness: v }));
	const setRadius = rafThrottle((v: number) => editor.update({ radius: v }));
	const setStockRadius = rafThrottle((v: number) => editor.setStockRadius(v));
	const setStroke = rafThrottle((v: number) => editor.update({ strokeWidth: v }));
	const setLineHeight = rafThrottle((v: number) => editor.update({ lineHeight: v }));
	const setLetterSpacing = rafThrottle((v: number) => editor.update({ letterSpacing: v }));
	const setCutoff = rafThrottle((v: number) => editor.update({ cutoff: v }));

	function int(value: string, fallback: number): number {
		const n = Math.round(Number(value));
		return Number.isFinite(n) ? n : fallback;
	}

	const aligns = [
		{ value: 'left', icon: AlignLeftIcon },
		{ value: 'center', icon: AlignCenterIcon },
		{ value: 'right', icon: AlignRightIcon }
	] as const;

	// same icon family the canvas toolbar uses for aligning elements, so the
	// two "align" gestures read as the same idea at different scopes
	const vAligns = [
		{ value: 'top', icon: AlignStartHorizontalIcon, label: 'Top' },
		{ value: 'middle', icon: AlignCenterHorizontalIcon, label: 'Middle' },
		{ value: 'bottom', icon: AlignEndHorizontalIcon, label: 'Bottom' }
	] as const;
</script>

{#if editor.labelSelected}
	<div class="space-y-4">
		<div class="space-y-1.5">
			<Label>Printer</Label>
			<Select.Root
				type="single"
				value={editor.template.printer}
				onValueChange={(v) => editor.setPrinter(v as PrinterId)}
			>
				<Select.Trigger class="w-full">
					<PrinterIcon class="size-4 text-muted-foreground" />
					{editor.model.name}
				</Select.Trigger>
				<Select.Content>
					{#each MODEL_LIST as m (m.id)}
						<Select.Item value={m.id} label={m.name} />
					{/each}
				</Select.Content>
			</Select.Root>
			<p class="text-xs text-muted-foreground">{editor.model.blurb}</p>
		</div>

		<div class="space-y-1.5">
			<Label>Size</Label>
			<MediaSelect />
		</div>

		{#if editor.model.features.direction}
			<div class="space-y-1.5">
				<Label>Feed direction</Label>
				<ToggleGroup.Root
					type="single"
					variant="outline"
					size="sm"
					class="w-full"
					value={editor.template.printDirection}
					onValueChange={(v) => v && editor.setPrintDirection(v as PrintDirection)}
				>
					<ToggleGroup.Item value="top" class="flex-1 text-xs">Top edge</ToggleGroup.Item>
					<ToggleGroup.Item value="left" class="flex-1 text-xs">Left edge</ToggleGroup.Item>
				</ToggleGroup.Root>
				<p class="text-xs text-muted-foreground">
					Which edge of the label leaves the printer first, so it decides which side has to fit
					across the {printableWidthMm(editor.model)} mm head — currently the {editor.template
						.printDirection === 'left'
						? 'height'
						: 'width'}. Get it wrong and the label prints a quarter turn off.
				</p>
			</div>
		{/if}

		{#if !editor.fit.fits}
			<div class="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-2.5">
				<p class="flex items-start gap-1.5 text-xs text-destructive">
					<TriangleAlertIcon class="mt-px size-3.5 shrink-0" />
					<span>This label is {editor.fit.reason}, so it cannot be printed as it is.</span>
				</p>
				<Button
					variant="outline"
					size="sm"
					class="w-full text-xs"
					onclick={() => editor.fitToPrinter()}
				>
					Resize to {printableWidthMm(editor.model)} mm
				</Button>
			</div>
		{/if}

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
							? // at full rounding the short axis is used up entirely, which is a
								// circle only when the label is square and a stadium otherwise
								editor.template.width === editor.template.height
								? 'round'
								: 'pill'
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
						disabled={el.sizing === 'fill'}
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
					disabled={el.sizing === 'fill'}
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
				<!-- stacked, not one row of six: the sidebar is too narrow for six
				     icon buttons, and a fixed two rows reads more steadily than a
				     wrap that reflows with the panel width -->
				<div class="flex flex-col gap-1">
					<div class="flex gap-1">
						{#each aligns as a (a.value)}
							<Button
								variant={el.align === a.value ? 'secondary' : 'ghost'}
								size="icon"
								title="Align {a.value}"
								onclick={() => editor.update({ align: a.value })}
							>
								<a.icon />
							</Button>
						{/each}
					</div>
					<div class="flex gap-1">
						{#each vAligns as v (v.value)}
							<Button
								variant={el.verticalAlign === v.value ? 'secondary' : 'ghost'}
								size="icon"
								title="Align {v.label.toLowerCase()}"
								onclick={() => editor.update({ verticalAlign: v.value })}
							>
								<v.icon />
							</Button>
						{/each}
					</div>
				</div>
			</div>
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<Label>Line height</Label>
					<span class="text-xs text-muted-foreground tabular-nums">
						{el.lineHeight.toFixed(2)}
					</span>
				</div>
				<Slider
					type="single"
					value={el.lineHeight}
					onValueChange={setLineHeight}
					min={MIN_LINE_HEIGHT}
					max={MAX_LINE_HEIGHT}
					step={0.05}
				/>
			</div>
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<Label>Letter spacing</Label>
					<span class="text-xs text-muted-foreground tabular-nums">
						{el.letterSpacing > 0 ? '+' : ''}{el.letterSpacing}
					</span>
				</div>
				<Slider
					type="single"
					value={el.letterSpacing}
					onValueChange={setLetterSpacing}
					min={MIN_LETTER_SPACING}
					max={MAX_LETTER_SPACING}
					step={1}
				/>
			</div>
			<div class="space-y-1.5">
				<Label>Text sizing</Label>
				<ToggleGroup.Root
					type="single"
					variant="outline"
					size="sm"
					class="w-full"
					value={el.sizing}
					onValueChange={(v) => v && editor.update({ sizing: v as TextSizing })}
				>
					<ToggleGroup.Item value="fixed" class="flex-1 text-xs">Fixed</ToggleGroup.Item>
					<ToggleGroup.Item value="shrink" class="flex-1 text-xs">Shrink</ToggleGroup.Item>
					<ToggleGroup.Item value="fill" class="flex-1 text-xs">Fill</ToggleGroup.Item>
				</ToggleGroup.Root>
				<p class="text-xs text-muted-foreground">
					{#if el.sizing === 'fill'}
						The box sets the size, growing as well as shrinking, and lines break only where you
						typed them. A field bound to a column sizes itself to what is on screen, so turn preview
						on to size it against real data.
					{:else if el.sizing === 'shrink'}
						Only ever comes down from the size above, and lines break only where you typed them — so
						a long value gets smaller rather than reflowing.
					{:else}
						Keeps the size above and wraps to fit the box, cutting off whatever still runs past it.
					{/if}
				</p>
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
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<!-- one value, two jobs: a hard cutoff for threshold, the dither's
					     own decision point for dither, where it reads as darkness -->
					<Label>{el.mode === 'dither' ? 'Darkness' : 'Cutoff'}</Label>
					<div class="flex items-center gap-2">
						{#if el.cutoff !== THRESHOLD}
							<!-- 128 is what the printer itself uses everywhere else, and
							     it is near impossible to land on by dragging -->
							<Button
								variant="ghost"
								size="sm"
								class="h-5 px-1.5 text-xs text-muted-foreground"
								onclick={() => editor.update({ cutoff: THRESHOLD })}
							>
								Reset
							</Button>
						{/if}
						<span class="text-xs text-muted-foreground tabular-nums">{el.cutoff}</span>
					</div>
				</div>
				<Slider
					type="single"
					value={el.cutoff}
					onValueChange={setCutoff}
					min={MIN_CUTOFF}
					max={MAX_CUTOFF}
					step={1}
				/>
				<p class="text-xs text-muted-foreground">
					{#if el.mode === 'dither'}
						Higher lays down more ink. The shift is strongest in the near-white and near-black
						areas, because dithering partly corrects itself through the midtones.
					{:else}
						Higher burns more of the image; lower keeps only the darkest parts.
					{/if}
				</p>
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
