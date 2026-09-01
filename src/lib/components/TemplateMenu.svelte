<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { editor } from '$lib/template/editor.svelte';
	import { TEMPLATE_EXT } from '$lib/template/library';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import LayoutTemplateIcon from '@lucide/svelte/icons/layout-template';
	import FilePlusIcon from '@lucide/svelte/icons/file-plus';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import CheckIcon from '@lucide/svelte/icons/check';

	/**
	 * Trigger styling is the caller's, because this renders in two places that
	 * look nothing alike: a full-width sidebar row on a phone, and a floating
	 * tool over the canvas on a desktop, which wears the same surface as the
	 * sidebar trigger and the label shortcut rather than a form control's.
	 */
	let {
		class: className = 'w-full',
		variant = 'outline'
	}: { class?: string; variant?: 'outline' | 'ghost' } = $props();

	/** Which naming dialog is open, and what it will do with the name. */
	let naming = $state<'saveAs' | 'rename' | null>(null);
	let draftName = $state('');
	let confirmDelete = $state<{ id: string; name: string } | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);

	const others = $derived(editor.library.filter((t) => t.id !== editor.template.id));

	function startNaming(mode: 'saveAs' | 'rename') {
		draftName = mode === 'rename' ? editor.template.name : `${editor.template.name} copy`;
		naming = mode;
	}

	async function applyName() {
		const name = draftName.trim();
		if (!name) return;
		if (naming === 'rename') editor.rename(name);
		else await editor.saveAs(name);
		naming = null;
	}

	function download() {
		const { name, json } = editor.exportFile();
		// A blob URL rather than a data URL: a template with embedded photos can
		// run past the length some browsers accept in an href.
		const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
		const a = document.createElement('a');
		a.href = url;
		a.download = name;
		a.click();
		URL.revokeObjectURL(url);
	}

	async function onFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		// cleared straight away so picking the same file twice fires again
		input.value = '';
		if (!file) return;
		try {
			await editor.importFile(await file.text());
			toast.success(`Imported ${editor.template.name}`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'could not import that file');
		}
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button {...props} {variant} size="sm" class="justify-between gap-2 {className}">
				<span class="flex min-w-0 items-center gap-2">
					<LayoutTemplateIcon class="size-4 shrink-0" />
					<span class="truncate text-foreground">{editor.template.name}</span>
				</span>
				<ChevronDownIcon class="size-4 shrink-0" />
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content class="w-64" align="start">
		<DropdownMenu.Group>
			<DropdownMenu.GroupHeading>Templates</DropdownMenu.GroupHeading>
			<DropdownMenu.Item onSelect={() => {}} class="font-medium">
				<CheckIcon class="size-4" />
				<span class="truncate">{editor.template.name}</span>
			</DropdownMenu.Item>
			{#each others as t (t.id)}
				<DropdownMenu.Item onSelect={() => editor.open(t.id)}>
					<span class="size-4"></span>
					<span class="truncate">{t.name}</span>
				</DropdownMenu.Item>
			{/each}
		</DropdownMenu.Group>

		<DropdownMenu.Separator />
		<DropdownMenu.Group>
			<DropdownMenu.Item onSelect={() => editor.createNew()}>
				<FilePlusIcon class="size-4" />
				New label
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={() => startNaming('saveAs')}>
				<CopyIcon class="size-4" />
				Duplicate…
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={() => startNaming('rename')}>
				<PencilIcon class="size-4" />
				Rename…
			</DropdownMenu.Item>
			<DropdownMenu.Item
				variant="destructive"
				onSelect={() => (confirmDelete = { id: editor.template.id, name: editor.template.name })}
			>
				<Trash2Icon class="size-4" />
				Delete…
			</DropdownMenu.Item>
		</DropdownMenu.Group>

		<DropdownMenu.Separator />
		<DropdownMenu.Group>
			<DropdownMenu.Item onSelect={download}>
				<DownloadIcon class="size-4" />
				Export file
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={() => fileInput?.click()}>
				<UploadIcon class="size-4" />
				Import file…
			</DropdownMenu.Item>
		</DropdownMenu.Group>
	</DropdownMenu.Content>
</DropdownMenu.Root>

<input
	bind:this={fileInput}
	type="file"
	accept="{TEMPLATE_EXT},application/json,.json"
	class="hidden"
	onchange={onFile}
/>

<Dialog.Root
	open={naming !== null}
	onOpenChange={(v) => {
		if (!v) naming = null;
	}}
>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>{naming === 'rename' ? 'Rename label' : 'Duplicate label'}</Dialog.Title>
			<Dialog.Description>
				{naming === 'rename'
					? 'What this template is called in the list.'
					: 'Saves a copy under a new name and opens it. The original is left as it is.'}
			</Dialog.Description>
		</Dialog.Header>
		<form
			class="space-y-4"
			onsubmit={(e) => {
				e.preventDefault();
				applyName();
			}}
		>
			<div class="space-y-1.5">
				<Label for="template-name">Name</Label>
				<!-- svelte-ignore a11y_autofocus -->
				<Input id="template-name" autofocus bind:value={draftName} />
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (naming = null)}>Cancel</Button>
				<Button type="submit" disabled={!draftName.trim()}>
					{naming === 'rename' ? 'Rename' : 'Duplicate'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root
	open={confirmDelete !== null}
	onOpenChange={(v) => {
		if (!v) confirmDelete = null;
	}}
>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Delete this label?</Dialog.Title>
			<Dialog.Description>
				“{confirmDelete?.name}” goes for good — undo does not reach a deleted template. Export it
				first if you might want it back.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (confirmDelete = null)}>Cancel</Button>
			<Button
				variant="destructive"
				onclick={async () => {
					const doomed = confirmDelete;
					confirmDelete = null;
					if (doomed) {
						await editor.deleteSaved(doomed.id);
						toast.success(`Deleted ${doomed.name}`);
					}
				}}
			>
				Delete
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
