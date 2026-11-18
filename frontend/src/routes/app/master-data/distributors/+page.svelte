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
	import type { DistributorsRecord } from '#lib/data/pocketbase-types.ts';

	const distributors = createCollection<DistributorsRecord>('distributors', {
		label: 'distributor'
	});
	distributors.load();

	const columns = createColumns<DistributorsRecord>([
		{
			header: 'Name',
			accessor: 'name',
			type: 'text',
			editable: true,
			searchable: true
		},
		{
			header: 'Website',
			accessor: 'website',
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

	function newDistributor(): DistributorsRecord {
		return { ...unsavedRecordFields(), name: '', website: '', description: '' };
	}

	let toDelete = $state<DistributorsRecord>();
	let deleteOpen = $state(false);
</script>

{#snippet rowActions({ row, isNew }: RowActionContext<DistributorsRecord>)}
	{#if !isNew}
		<RowActionsMenu
			id={row.id}
			label={row.name}
			entityLabel="distributor"
			onDelete={() => {
				toDelete = row;
				deleteOpen = true;
			}}
		/>
	{/if}
{/snippet}

<DataTable
	data={distributors.data}
	{columns}
	{rowActions}
	createRow={newDistributor}
	onUpdate={(row) => distributors.update([row])}
	onCreate={(row) => distributors.create([row])}
/>

<ConfirmDeleteDialog
	bind:open={deleteOpen}
	itemName={toDelete?.name ?? ''}
	entityLabel="distributor"
	onConfirm={() => toDelete && distributors.remove(toDelete)}
/>
