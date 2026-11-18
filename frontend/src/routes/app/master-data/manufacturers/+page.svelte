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
	import type { ManufacturersRecord } from '#lib/data/pocketbase-types.ts';

	const manufacturers = createCollection<ManufacturersRecord>('manufacturers', {
		label: 'manufacturer'
	});
	manufacturers.load();

	const columns = createColumns<ManufacturersRecord>([
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

	function newManufacturer(): ManufacturersRecord {
		return { ...unsavedRecordFields(), name: '', description: '' };
	}

	let toDelete = $state<ManufacturersRecord>();
	let deleteOpen = $state(false);
</script>

{#snippet rowActions({ row, isNew }: RowActionContext<ManufacturersRecord>)}
	{#if !isNew}
		<RowActionsMenu
			id={row.id}
			label={row.name}
			entityLabel="manufacturer"
			onDelete={() => {
				toDelete = row;
				deleteOpen = true;
			}}
		/>
	{/if}
{/snippet}

<DataTable
	data={manufacturers.data}
	{columns}
	{rowActions}
	createRow={newManufacturer}
	onUpdate={(row) => manufacturers.update([row])}
	onCreate={(row) => manufacturers.create([row])}
/>

<ConfirmDeleteDialog
	bind:open={deleteOpen}
	itemName={toDelete?.name ?? ''}
	entityLabel="manufacturer"
	onConfirm={() => toDelete && manufacturers.remove(toDelete)}
/>
