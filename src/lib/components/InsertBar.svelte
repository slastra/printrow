<script lang="ts">
	import { editor } from '$lib/template/editor.svelte';
	import { ELEMENT_META, type ElementKind } from '$lib/template/elements';
	import { pickFile } from '$lib/utils';
	import ToolButton from './ToolButton.svelte';

	const kinds: ElementKind[] = ['text', 'barcode', 'image', 'rect'];

	async function insert(kind: ElementKind) {
		if (kind === 'image') {
			const file = await pickFile('image/*');
			if (file) editor.addImageFromFile(file);
		} else {
			editor.add(kind);
		}
	}
</script>

<div class="flex items-center gap-0.5 rounded-md border bg-card p-1 shadow-md">
	{#each kinds as kind (kind)}
		<ToolButton
			label={ELEMENT_META[kind].name}
			icon={ELEMENT_META[kind].icon}
			onclick={() => insert(kind)}
			size="size-9"
		/>
	{/each}
</div>
