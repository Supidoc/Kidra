<script lang="ts">
	import {
		createColumns,
		TreeTable,
		type RowActionContext
	} from '#lib/components/data-table/index.js';
	import ConfirmDeleteDialog from '#lib/components/confirm-delete-dialog.svelte';
	import RowActionsMenu from '#lib/components/row-actions-menu.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { PlusIcon } from '@lucide/svelte';
	import { createCollection } from '#lib/data/collection.svelte.ts';
	import { unsavedRecordFields } from '#lib/data/records.ts';
	import { buildTree, treeRecord, type TreeRow } from '#lib/data/library-tree.ts';
	import type { UnitSetsRecord, UnitsRecord } from '#lib/data/pocketbase-types.ts';
	import UnitFormDialog, { type UnitFormValues } from './unit-form-dialog.svelte';

	type UnitTreeRow = TreeRow<UnitSetsRecord, UnitsRecord>;

	const unitSets = createCollection<UnitSetsRecord>('unitSets', { label: 'unit set' });
	const units = createCollection<UnitsRecord>('units', { label: 'unit' });
	unitSets.load();
	units.load();

	const isUnit = (row: UnitTreeRow) => row.kind === 'item';

	const columns = createColumns<UnitTreeRow>([
		{ header: 'Name', accessor: 'name', type: 'text', editable: true, searchable: true },
		{ header: 'Symbol', accessor: 'symbolFancy', type: 'text', editable: isUnit, searchable: true },
		{
			header: 'Letter',
			accessor: 'symbolLetter',
			type: 'text',
			editable: isUnit,
			searchable: true
		},
		{ header: 'Factor', accessor: 'factor', type: 'number', editable: isUnit }
	]);

	const tree = $derived(buildTree(unitSets.data, units.data, (unit) => unit.unitSet));

	function updateRow(row: UnitTreeRow) {
		if (row.kind === 'group') return unitSets.update([treeRecord<UnitSetsRecord>(row)]);
		return units.update([treeRecord<UnitsRecord>(row)]);
	}

	let formOpen = $state(false);
	let formUnitSet = $state<UnitSetsRecord>();

	function openForm(unitSet?: UnitSetsRecord) {
		formUnitSet = unitSet;
		formOpen = true;
	}

	function saveForm({ name, ...unit }: UnitFormValues) {
		const record = { ...unsavedRecordFields(), name };
		if (!formUnitSet) return unitSets.create([record]);
		return units.create([{ ...record, ...unit, unitSet: formUnitSet.id }]);
	}

	let toDelete = $state<UnitsRecord>();
	let deleteOpen = $state(false);
</script>

{#snippet toolbarActions()}
	<Button size="sm" onclick={() => openForm()}><PlusIcon /> Add unit set</Button>
{/snippet}

{#snippet rowActions({ row }: RowActionContext<UnitTreeRow>)}
	{#if row.kind === 'group'}
		<Button
			variant="ghost"
			size="icon"
			class="size-8"
			aria-label="Add unit to {row.name}"
			onclick={() => openForm(treeRecord<UnitSetsRecord>(row))}
		>
			<PlusIcon />
		</Button>
	{:else}
		<RowActionsMenu
			id={row.id}
			label={row.name}
			entityLabel="unit"
			onDelete={() => {
				toDelete = row;
				deleteOpen = true;
			}}
		/>
	{/if}
{/snippet}

<TreeTable
	data={tree}
	getSubRows={(row) => row.children}
	{columns}
	{toolbarActions}
	{rowActions}
	onUpdate={updateRow}
/>

<UnitFormDialog bind:open={formOpen} unitSet={formUnitSet} onSave={saveForm} />

<ConfirmDeleteDialog
	bind:open={deleteOpen}
	itemName={toDelete?.name ?? ''}
	entityLabel="unit"
	onConfirm={() => toDelete && units.remove(toDelete)}
/>
