<script lang="ts">
	import { onMount } from 'svelte';
	import { toggleMode } from 'mode-watcher';
	import { editor } from '$lib/template/editor.svelte';
	import { data as csv } from '$lib/template/data.svelte';
	import LabelEditor from '$lib/components/LabelEditor.svelte';
	import Inspector from '$lib/components/Inspector.svelte';
	import DataPanel from '$lib/components/DataPanel.svelte';
	import EditorToolbar from '$lib/components/EditorToolbar.svelte';
	import LayersPanel from '$lib/components/LayersPanel.svelte';
	import InsertBar from '$lib/components/InsertBar.svelte';
	import PrintButton from '$lib/components/PrintButton.svelte';
	import CsvImportButton from '$lib/components/CsvImportButton.svelte';
	import LabelShortcut from '$lib/components/LabelShortcut.svelte';
	import AboutDialog from '$lib/components/AboutDialog.svelte';
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
			{#if csv.loaded}
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
			<AboutDialog />
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
					class="size-9 rounded-lg border border-border bg-(--surface-tool) shadow-(--shadow-tool) backdrop-blur-[10px] hover:bg-accent"
				/>
			</div>

			<!-- source link, top right -->
			<a
				href="https://github.com/slastra/printrow"
				target="_blank"
				rel="noreferrer"
				title="Source on GitHub"
				class="absolute top-3 right-3 z-10 hidden size-9 float-in-down items-center justify-center rounded-lg border border-border bg-(--surface-tool) text-muted-foreground shadow-(--shadow-tool) backdrop-blur-[10px] transition-colors float-step-1 hover:text-foreground lg:flex"
			>
				<!-- lucide dropped brand marks, so the GitHub glyph is inline -->
				<svg viewBox="0 0 16 16" fill="currentColor" class="size-4" aria-hidden="true">
					<path
						d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
					/>
				</svg>
				<span class="sr-only">Source on GitHub</span>
			</a>

			<!-- Context toolbar. Mobile hugs the right, clear of the sidebar
			     trigger; desktop centres. Centring an absolute box needs BOTH
			     edges set, so the switch is mr-0 vs mr-auto — not right-auto,
			     which would strand it on the left. -->
			<div
				class="absolute top-3 right-3 left-14 z-10 mr-0 ml-auto w-fit max-w-full float-in-down float-step-1 lg:right-14 lg:mr-auto"
			>
				<EditorToolbar />
			</div>

			<!-- label properties, bottom left (desktop only: the phone reaches the
			     same panel through the sidebar sheet) -->
			<div class="absolute bottom-3 left-3 z-10 hidden float-in-up float-step-3 lg:block">
				<LabelShortcut />
			</div>

			<!-- insert bar, bottom center -->
			<div class="absolute inset-x-0 bottom-3 z-10 mx-auto w-fit float-in-up float-step-2">
				<InsertBar />
			</div>
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
