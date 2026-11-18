<script lang="ts">
	import {
		createColumns,
		TreeTable,
		type RowActionContext
	} from '#lib/components/data-table/index.js';
	import ConfirmDeleteDialog from '#lib/components/confirm-delete-dialog.svelte';
	import { PreviewPanel } from '#lib/components/preview/index.js';
	import RowActionsMenu from '#lib/components/row-actions-menu.svelte';
	import { createCollection } from '#lib/data/collection.svelte.ts';
	import { symbolPreviewUrl } from '#lib/data/kicad-previews.ts';
	import { buildLibraryTree, type TreeRow } from '#lib/data/library-tree.ts';
	import type { SymbolLibrariesRecord, SymbolsRecord } from '#lib/data/pocketbase-types.ts';

	type SymbolTreeRow = TreeRow<SymbolLibrariesRecord, SymbolsRecord>;

	const libraries = createCollection<SymbolLibrariesRecord>('symbolLibraries', {
		label: 'symbol library'
	});
	const symbols = createCollection<SymbolsRecord>('symbols', { label: 'symbol' });
	libraries.load();
	symbols.load();

	const columns = createColumns<SymbolTreeRow>([
		{ header: 'Name', accessor: 'name', type: 'text', searchable: true },
		{ header: 'Available', accessor: 'available', type: 'boolean' },
		{ header: 'Pins', accessor: 'pinCount', type: 'number' },
		{ header: 'Description', accessor: 'description', type: 'text', searchable: true },
		{ header: 'Created', accessor: 'created', type: 'dateTime', dateFormat: 'MM/dd/yyyy HH:mm' },
		{ header: 'Updated', accessor: 'updated', type: 'dateTime', dateFormat: 'MM/dd/yyyy HH:mm' }
	]);

	const tree = $derived(buildLibraryTree(libraries.data, symbols.data));

	let selectedId = $state('');
	const selected = $derived(symbols.data.find((symbol) => symbol.id === selectedId));
	const previewUrl = $derived(selected ? symbolPreviewUrl(selected) : '');

	let toDelete = $state<SymbolsRecord>();
	let deleteOpen = $state(false);
</script>

{#snippet rowActions({ row }: RowActionContext<SymbolTreeRow>)}
	{#if row.kind === 'item'}
		<RowActionsMenu
			id={row.id}
			label={row.name}
			entityLabel="symbol"
			onDelete={() => {
				toDelete = row;
				deleteOpen = true;
			}}
		/>
	{/if}
{/snippet}

<div class="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]">
	<TreeTable
		data={tree}
		getSubRows={(row) => row.children}
		{columns}
		{rowActions}
		selectedRowId={selectedId}
		onRowClick={(row) => {
			if (row.kind === 'item') selectedId = row.id;
		}}
	/>
	<PreviewPanel
		class="xl:sticky xl:top-4"
		title={selected?.name ?? ''}
		detail={libraries.data.find((library) => library.id === selected?.library)?.name}
		placeholder="Select a symbol"
		preview={previewUrl && selected
			? { kind: 'svg', src: previewUrl, name: `${selected.name}.svg` }
			: null}
		emptyText={selected ? 'No preview available.' : 'Click a symbol to preview it.'}
	>
		{#if selected?.pinCount}
			<p class="text-sm text-muted-foreground">{selected.pinCount} pins</p>
		{/if}
	</PreviewPanel>
</div>

<ConfirmDeleteDialog
	bind:open={deleteOpen}
	itemName={toDelete?.name ?? ''}
	entityLabel="symbol"
	onConfirm={() => toDelete && symbols.remove(toDelete)}
/>
