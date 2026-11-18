<script lang="ts">
	import {
		createColumns,
		DataTable,
		type RowActionContext
	} from '#lib/components/data-table/index.js';
	import ConfirmDeleteDialog from '#lib/components/confirm-delete-dialog.svelte';
	import RowActionsMenu from '#lib/components/row-actions-menu.svelte';
	import { createCollection } from '#lib/data/collection.svelte.ts';
	import { unsavedRecordFields } from '#lib/data/records.ts';
	import type { CategoriesRecord } from '#lib/data/pocketbase-types.ts';

	const categories = createCollection<CategoriesRecord>('categories', { label: 'category' });
	categories.load();

	const columns = createColumns<CategoriesRecord>([
		{
			header: 'Name',
			accessor: 'name',
			type: 'text',
			editable: true,
			searchable: true
		},
		{
			header: 'Description',
			accessor: 'description',
			type: 'text',
			editable: true,
			searchable: true
		},
		{
			header: 'Created',
			accessor: 'created',
			type: 'dateTime',
			dateFormat: 'MM/dd/yyyy HH:mm'
		},
		{
			header: 'Updated',
			accessor: 'updated',
			type: 'dateTime',
			dateFormat: 'MM/dd/yyyy HH:mm'
		}
	]);

	function newCategory(): CategoriesRecord {
		return { ...unsavedRecordFields(), name: '', description: '' };
	}

	let toDelete = $state<CategoriesRecord>();
	let deleteOpen = $state(false);
</script>

{#snippet rowActions({ row, isNew }: RowActionContext<CategoriesRecord>)}
	{#if !isNew}
		<RowActionsMenu
			id={row.id}
			label={row.name}
			entityLabel="category"
			onDelete={() => {
				toDelete = row;
				deleteOpen = true;
			}}
		/>
	{/if}
{/snippet}

<DataTable
	data={categories.data}
	{columns}
	{rowActions}
	createRow={newCategory}
	onUpdate={(row) => categories.update([row])}
	onCreate={(row) => categories.create([row])}
/>

<ConfirmDeleteDialog
	bind:open={deleteOpen}
	itemName={toDelete?.name ?? ''}
	entityLabel="category"
	onConfirm={() => toDelete && categories.remove(toDelete)}
/>
