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
	import TemplateMenu from '$lib/components/TemplateMenu.svelte';
	import LabelShortcut from '$lib/components/LabelShortcut.svelte';
	import AboutDialog from '$lib/components/AboutDialog.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar';
	import { Button } from '$lib/components/ui/button';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import { SEO } from '$lib/seo';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();

	onMount(() => {
		void editor.load();
	});
</script>

<!--
	Search and link-preview metadata. Everything here is static because the app
	is a single page: there is nothing per-route to vary, and the crawler only
	ever sees the SSR shell (the editor itself is client-side).

	The claims are deliberately the factual ones — no install, no driver, no
	account, nothing leaving the browser — rather than comparisons against the
	vendor apps, which would be unverifiable and would age badly.
-->
<svelte:head>
	<title>{SEO.title}</title>
	<meta name="description" content={SEO.description} />
	<link rel="canonical" href={SEO.url} />

	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="printrow" />
	<meta property="og:url" content={SEO.url} />
	<meta property="og:title" content={SEO.title} />
	<meta property="og:description" content={SEO.description} />
	<meta property="og:image" content="{SEO.url}og.jpg" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={SEO.imageAlt} />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={SEO.title} />
	<meta name="twitter:description" content={SEO.description} />
	<meta name="twitter:image" content="{SEO.url}og.jpg" />

	<!-- matches the dark shell the app boots into, so mobile chrome does not
	     flash white around it -->
	<meta name="theme-color" content="#0a0a0a" />

	{@html `<script type="application/ld+json">${JSON.stringify(SEO.schema)}</script>`}
</svelte:head>

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
				<!-- desktop reaches this from the canvas instead, top right -->
				<TemplateMenu class="w-full lg:hidden" />
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

			<!-- which template is open, top right. Desktop only: the phone reaches
			     the same menu from the sidebar sheet, where it started. -->
			<div class="absolute top-3 right-3 z-10 hidden float-in-down float-step-1 lg:block">
				<TemplateMenu
					class="w-48 border-border bg-(--surface-tool) shadow-(--shadow-tool) backdrop-blur-[10px]"
				/>
			</div>

			<!-- Context toolbar. Mobile hugs the right, clear of the sidebar
			     trigger; desktop centres. Centring an absolute box needs BOTH
			     edges set, so the switch is mr-0 vs mr-auto — not right-auto,
			     which would strand it on the left. The desktop right inset clears
			     the template menu, which is far wider than the icon it replaced. -->
			<div
				class="absolute top-3 right-3 left-14 z-10 mr-0 ml-auto w-fit max-w-full float-in-down float-step-1 lg:right-56 lg:mr-auto"
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
