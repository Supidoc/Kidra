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
	import type { DesignatorsRecord } from '#lib/data/pocketbase-types.ts';

	const designators = createCollection<DesignatorsRecord>('designators', { label: 'designator' });
	designators.load();

	const columns = createColumns<DesignatorsRecord>([
		{
			header: 'Name',
			accessor: 'name',
			type: 'text',
			editable: true,
			searchable: true
		},
		{
			header: 'Designator String',
			accessor: 'designatorString',
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

	function newDesignator(): DesignatorsRecord {
		return { ...unsavedRecordFields(), name: '', designatorString: '' };
	}

	let toDelete = $state<DesignatorsRecord>();
	let deleteOpen = $state(false);
</script>

{#snippet rowActions({ row, isNew }: RowActionContext<DesignatorsRecord>)}
	{#if !isNew}
		<RowActionsMenu
			id={row.id}
			label={row.name}
			entityLabel="designator"
			onDelete={() => {
				toDelete = row;
				deleteOpen = true;
			}}
		/>
	{/if}
{/snippet}

<DataTable
	data={designators.data}
	{columns}
	{rowActions}
	createRow={newDesignator}
	onUpdate={(row) => designators.update([row])}
	onCreate={(row) => designators.create([row])}
/>

<ConfirmDeleteDialog
	bind:open={deleteOpen}
	itemName={toDelete?.name ?? ''}
	entityLabel="designator"
	onConfirm={() => toDelete && designators.remove(toDelete)}
/>
