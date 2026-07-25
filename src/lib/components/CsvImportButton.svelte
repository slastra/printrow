<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { data } from '$lib/template/data.svelte';
	import { Button } from '$lib/components/ui/button';
	import { pickFile } from '$lib/utils';
	import UploadIcon from '@lucide/svelte/icons/upload';

	async function onImport() {
		const file = await pickFile('.csv,text/csv');
		if (!file) return;
		try {
			await data.loadFile(file);
			toast.success(`${data.rows.length} rows from ${file.name}`);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'could not parse CSV');
		}
	}
</script>

<Button variant="outline" size="sm" onclick={onImport}>
	<UploadIcon />
	<span class="hidden sm:inline">{data.loaded ? 'Replace CSV' : 'Import CSV'}</span>
	<span class="sm:hidden">CSV</span>
</Button>
