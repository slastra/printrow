<script lang="ts">
	import { onMount } from 'svelte';
	import { editor } from '$lib/template/editor.svelte';
	import LabelEditor from '$lib/components/LabelEditor.svelte';
	import Inspector from '$lib/components/Inspector.svelte';
	import DataPanel from '$lib/components/DataPanel.svelte';
	import EditorToolbar from '$lib/components/EditorToolbar.svelte';
	import LayersPanel from '$lib/components/LayersPanel.svelte';
	import InsertBar from '$lib/components/InsertBar.svelte';
	import MediaSelect from '$lib/components/MediaSelect.svelte';
	import PrintButton from '$lib/components/PrintButton.svelte';
	import CsvImportButton from '$lib/components/CsvImportButton.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Card from '$lib/components/ui/card';
	import Layers2Icon from '@lucide/svelte/icons/layers-2';
	import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal';

	// mobile: side panels collapse behind toggles; lg+ shows them always
	let showLayers = $state(false);
	let showInspect = $state(false);

	onMount(() => editor.load());
</script>

<svelte:head><title>printrow</title></svelte:head>

<div class="flex h-dvh flex-col overflow-hidden">
	<header class="z-20 flex flex-wrap items-center gap-3 border-b bg-background px-4 py-2">
		<h1 class="text-base font-semibold tracking-tight">printrow</h1>
		<Input
			class="h-8 w-40 sm:w-56"
			value={editor.template.name}
			oninput={(e) => editor.rename(e.currentTarget.value)}
		/>
		<span class="text-xs text-muted-foreground">{editor.saved ? 'saved' : 'saving…'}</span>
		<div class="ml-auto flex items-center gap-2">
			<CsvImportButton />
			<PrintButton />
		</div>
	</header>

	<div class="relative flex-1 overflow-hidden bg-muted/30">
		<!-- the canvas fills the window; everything else floats above it -->
		<LabelEditor />

		<!-- context toolbar, top center -->
		<div class="pointer-events-none absolute inset-x-14 top-3 z-10 flex justify-center">
			<div class="pointer-events-auto max-w-full">
				<EditorToolbar />
			</div>
		</div>

		<!-- mobile panel toggles -->
		<Button
			variant="outline"
			size="icon"
			class="absolute top-3 left-3 z-10 shadow-md lg:hidden"
			onclick={() => (showLayers = !showLayers)}
		>
			<Layers2Icon />
		</Button>
		<Button
			variant="outline"
			size="icon"
			class="absolute top-3 right-3 z-10 shadow-md lg:hidden"
			onclick={() => (showInspect = !showInspect)}
		>
			<SlidersHorizontalIcon />
		</Button>

		<!-- layers, floating left -->
		<div
			class="absolute top-16 bottom-16 left-3 z-10 w-56 {showLayers
				? 'block'
				: 'hidden'} pointer-events-none lg:block"
		>
			<Card.Root class="pointer-events-auto flex max-h-full flex-col overflow-hidden shadow-md">
				<Card.Header><Card.Title>Layers</Card.Title></Card.Header>
				<Card.Content class="overflow-y-auto"><LayersPanel /></Card.Content>
			</Card.Root>
		</div>

		<!-- inspector + data, floating right -->
		<!-- p-2 gives card shadows room inside the scroll container so they
		     don't clip into hard edges; the offsets compensate -->
		<div
			class="absolute top-14 right-1 bottom-14 z-10 w-[19rem] {showInspect
				? 'block'
				: 'hidden'} pointer-events-none space-y-3 overflow-y-auto p-2 lg:block"
		>
			<Card.Root class="pointer-events-auto shadow-md">
				<Card.Header><Card.Title>Element</Card.Title></Card.Header>
				<Card.Content><Inspector /></Card.Content>
			</Card.Root>
			<Card.Root class="pointer-events-auto shadow-md">
				<Card.Header><Card.Title>Data</Card.Title></Card.Header>
				<Card.Content><DataPanel /></Card.Content>
			</Card.Root>
		</div>

		<!-- insert bar, bottom center -->
		<div class="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center">
			<div class="pointer-events-auto">
				<InsertBar />
			</div>
		</div>

		<!-- media size, bottom left -->
		<div class="absolute bottom-3 left-3 z-10">
			<MediaSelect />
		</div>
	</div>
</div>
