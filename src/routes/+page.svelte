<script lang="ts">
	import { onMount } from 'svelte';
	import { toggleMode } from 'mode-watcher';
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
	import * as Sidebar from '$lib/components/ui/sidebar';
	import { Button } from '$lib/components/ui/button';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();

	onMount(() => editor.load());
</script>

<svelte:head><title>printrow</title></svelte:head>

<Sidebar.Provider open={data.sidebarOpen}>
	<Sidebar.Root variant="inset" class="border-none">
		<Sidebar.Header class="gap-3 px-3 py-4">
			<span
				class="text-4xl font-extrabold tracking-tight"
				style="font-family: 'Bricolage Grotesque Variable', sans-serif;"
			>
				printrow
			</span>
			<div class="flex flex-col gap-2">
				<CsvImportButton />
				<PrintButton />
			</div>
		</Sidebar.Header>
		<Sidebar.Content>
			<Sidebar.Group>
				<Sidebar.GroupLabel>Element</Sidebar.GroupLabel>
				<Sidebar.GroupContent class="px-2">
					<Inspector />
				</Sidebar.GroupContent>
			</Sidebar.Group>
			<Sidebar.Group>
				<Sidebar.GroupLabel>Data</Sidebar.GroupLabel>
				<Sidebar.GroupContent class="px-2">
					<DataPanel />
				</Sidebar.GroupContent>
			</Sidebar.Group>
			<Sidebar.Group>
				<Sidebar.GroupLabel>Layers</Sidebar.GroupLabel>
				<Sidebar.GroupContent class="px-2">
					<LayersPanel />
				</Sidebar.GroupContent>
			</Sidebar.Group>
		</Sidebar.Content>
		<Sidebar.Footer>
			<Button variant="ghost" size="sm" class="justify-start gap-2" onclick={toggleMode}>
				<SunIcon class="size-4 dark:hidden" />
				<MoonIcon class="hidden size-4 dark:block" />
				<span>Toggle theme</span>
			</Button>
		</Sidebar.Footer>
	</Sidebar.Root>

	<Sidebar.Inset class="border">
		<div class="relative flex-1 overflow-hidden rounded-[inherit] bg-muted/30">
			<!-- the canvas fills the inset; everything else floats above it -->
			<LabelEditor />

			<!-- sidebar toggle, top left -->
			<div class="absolute top-3 left-3 z-10">
				<Sidebar.Trigger class="size-9 rounded-md border bg-card shadow-md hover:bg-accent" />
			</div>

			<!-- context toolbar, top center -->
			<div class="pointer-events-none absolute inset-x-14 top-3 z-10 flex justify-center">
				<div class="pointer-events-auto max-w-full">
					<EditorToolbar />
				</div>
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
	</Sidebar.Inset>
</Sidebar.Provider>
