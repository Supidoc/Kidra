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
	import type { TagsPartsCountViewRecord, TagsRecord } from '#lib/data/pocketbase-types.ts';

	// The view adds `partCount` but is read-only: writes go to `tags`, then the view is reloaded.
	const tags = createCollection<TagsPartsCountViewRecord>('tagsPartsCountView', { label: 'tags' });
	const tagRecords = createCollection<TagsRecord>('tags', { label: 'tag' });
	tags.load();

	async function reloadAfter(write: Promise<boolean>) {
		if (!(await write)) return false;
		await tags.load();
		return true;
	}

	function withTrimmedName(row: TagsPartsCountViewRecord): TagsRecord {
		return { id: row.id, name: row.name?.trim(), created: row.created, updated: row.updated };
	}

	const columns = createColumns<TagsPartsCountViewRecord>([
		{
			header: 'Name',
			accessor: 'name',
			type: 'text',
			editable: true,
			searchable: true
		},
		{
			header: 'Parts',
			accessor: 'partCount',
			type: 'number'
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

	function newTag(): TagsPartsCountViewRecord {
		return { ...unsavedRecordFields(), name: '', partCount: 0 };
	}

	let toDelete = $state<TagsPartsCountViewRecord>();
	let deleteOpen = $state(false);

	const partCount = $derived(toDelete?.partCount ?? 0);
</script>

{#snippet rowActions({ row, isNew }: RowActionContext<TagsPartsCountViewRecord>)}
	{#if !isNew}
		<RowActionsMenu
			id={row.id}
			label={row.name ?? ''}
			entityLabel="tag"
			onDelete={() => {
				toDelete = row;
				deleteOpen = true;
			}}
		/>
	{/if}
{/snippet}

<DataTable
	data={tags.data}
	{columns}
	{rowActions}
	createRow={newTag}
	onUpdate={(row) => reloadAfter(tagRecords.update([withTrimmedName(row)]))}
	onCreate={(row) => reloadAfter(tagRecords.create([withTrimmedName(row)]))}
/>

<ConfirmDeleteDialog
	bind:open={deleteOpen}
	itemName={toDelete?.name ?? ''}
	entityLabel="tag"
	extraText={partCount
		? `It will also be removed from ${partCount} ${partCount === 1 ? 'part' : 'parts'}.`
		: undefined}
	onConfirm={() => toDelete && reloadAfter(tagRecords.remove(toDelete))}
/>
