<script lang="ts">
	import { onMount } from 'svelte';
	import { toggleMode } from 'mode-watcher';
	import { editor } from '$lib/template/editor.svelte';
	import { data } from '$lib/template/data.svelte';
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
		<Sidebar.Header class="gap-3 px-4 pt-2.5 pb-4">
			<span class="mb-3 flex items-end gap-2">
				<span
					class="text-4xl leading-none font-extrabold tracking-tight"
					style="font-family: 'Bricolage Grotesque Variable', sans-serif;"
				>
					printrow
				</span>
				<!-- 2×2 dot-matrix mark, one dot deliberately unprinted -->
				<span class="mb-1 grid grid-cols-2 gap-[3px]" aria-hidden="true">
					<span class="size-1.5 bg-primary"></span>
					<span class="size-1.5 bg-primary"></span>
					<span class="size-1.5 bg-primary/25"></span>
					<span class="size-1.5 bg-primary"></span>
				</span>
			</span>
			<div class="flex flex-col gap-2">
				<CsvImportButton />
				<PrintButton />
			</div>
		</Sidebar.Header>
		<Sidebar.Content>
			<Sidebar.Separator />
			<Sidebar.Group>
				<Sidebar.GroupLabel>Element</Sidebar.GroupLabel>
				<Sidebar.GroupContent class="px-2">
					<Inspector />
				</Sidebar.GroupContent>
			</Sidebar.Group>
			{#if data.loaded}
				<Sidebar.Separator />
				<Sidebar.Group>
					<Sidebar.GroupLabel>Data</Sidebar.GroupLabel>
					<Sidebar.GroupContent class="px-2">
						<DataPanel />
					</Sidebar.GroupContent>
				</Sidebar.Group>
			{/if}
			<Sidebar.Separator />
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
		<div class="relative flex-1 overflow-hidden rounded-[inherit] bg-muted/30 workspace-dots">
			<!-- the canvas fills the inset; everything else floats above it -->
			<LabelEditor />

			<!-- sidebar toggle, top left -->
			<div class="absolute top-3 left-3 z-10 float-in-down">
				<!-- explicit utilities beat the trigger's own button classes reliably -->
				<Sidebar.Trigger
					class="size-9 rounded-lg border border-border bg-card/85 shadow-[0_1px_2px_rgb(0_0_0/0.06),0_8px_24px_-8px_rgb(0_0_0/0.18)] backdrop-blur-[10px] hover:bg-accent dark:bg-card/85"
				/>
			</div>

			<!-- context toolbar, top center -->
			<div
				class="pointer-events-none absolute inset-x-14 top-3 z-10 flex float-in-down justify-center"
				style="animation-delay: 60ms"
			>
				<div class="pointer-events-auto max-w-full">
					<EditorToolbar />
				</div>
			</div>

			<!-- insert bar, bottom center -->
			<div
				class="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex float-in-up justify-center"
				style="animation-delay: 120ms"
			>
				<div class="pointer-events-auto">
					<InsertBar />
				</div>
			</div>

			<!-- media size, bottom left -->
			<div class="absolute bottom-3 left-3 z-10 float-in-up" style="animation-delay: 180ms">
				<MediaSelect />
			</div>
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
