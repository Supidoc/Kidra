<script lang="ts">
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import {
		createColumns,
		DataTable,
		type RowActionContext
	} from '#lib/components/data-table/index.js';
	import ConfirmDeleteDialog from '#lib/components/confirm-delete-dialog.svelte';
	import RowActionsMenu from '#lib/components/row-actions-menu.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { PencilIcon, ScanSearchIcon } from '@lucide/svelte';
	import { createCollection } from '#lib/data/collection.svelte.ts';
	import { errorMessage } from '#lib/data/errors.ts';
	import { savePart, type PartDraft } from '#lib/data/parts.ts';
	import type { PartsRecord } from '#lib/data/pocketbase-types.ts';
	import { notify } from '#lib/notify.ts';
	import PartDialogContent from './part-dialog/part-dialog-content.svelte';
	import { loadPartLookups } from './part-dialog/part-lookups.svelte.ts';
	import type { Mode } from './part-dialog/types.ts';

	const parts = createCollection<PartsRecord>('parts', {
		label: 'part',
		listOptions: { expand: 'category,tags' }
	});
	// `?part=<id>` (e.g. from the checks page) opens that part in the dialog once loaded.
	parts.load().then(openFromQuery);

	/** The dialog's reset reads the lookups, so it only opens its form once they are ready. */
	const partLookups = loadPartLookups();

	let dialogOpen = $state(false);
	let dialogMode = $state<Mode>('create');
	let selectedPart = $state<PartsRecord | null>(null);
	let toDelete = $state<PartsRecord>();
	let deleteOpen = $state(false);

	function openCreateDialog() {
		selectedPart = null;
		dialogMode = 'create';
		dialogOpen = true;
	}

	function openPartDialog(part: PartsRecord, mode: Exclude<Mode, 'create'>) {
		selectedPart = part;
		dialogMode = mode;
		dialogOpen = true;
	}

	function openFromQuery() {
		const id = page.url.searchParams.get('part');
		if (!id) return;
		const part = parts.data.find((item) => item.id === id);
		if (part) openPartDialog(part, 'edit');
		else notify.warning('The linked part was not found.');
		const url = new URL(page.url.href);
		url.searchParams.delete('part');
		replaceState(url, page.state);
	}

	function closeDialog() {
		dialogOpen = false;
		selectedPart = null;
	}

	// The save is one atomic batch: on failure nothing was written and the dialog stays open for a retry.
	async function handleSave(draft: PartDraft) {
		try {
			await savePart({
				...draft,
				previous: selectedPart,
				existingTags: partLookups.lookups.tags,
				saved: {
					ratings: partLookups.lookups.ratings,
					distributorParts: partLookups.lookups.distributorParts,
					attachments: partLookups.lookups.attachments
				}
			});
		} catch (error) {
			notify.error(`Failed to save part: ${errorMessage(error)}`);
			return;
		}
		notify.success('Part saved');
		// Reload before closing, so editing the part again starts from the saved rows.
		await Promise.all([
			parts.load(),
			partLookups.reload(['ratings', 'distributorParts', 'attachments', 'tags'])
		]);
		closeDialog();
	}

	const columns = createColumns<PartsRecord>([
		{
			header: 'Category',
			accessor: 'expand.category.name',
			type: 'text',
			searchable: true
		},
		{
			header: 'Value',
			accessor: 'valueRaw',
			type: 'text',
			searchable: true
		},
		{
			header: 'Description',
			accessor: 'description',
			type: 'text',
			searchable: true
		},
		{
			header: 'Tags',
			accessor: 'expand.tags',
			id: 'tags',
			type: 'tags',
			searchable: true
		},
		{
			header: 'Attachments',
			accessor: (row) => row.attachments?.length ?? 0,
			id: 'attachments',
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
</script>

{#snippet partActions({ row, isNew }: RowActionContext<PartsRecord>)}
	{#if !isNew}
		<div class="flex items-center justify-end gap-1">
			<Button
				variant="ghost"
				size="icon-sm"
				aria-label={`View ${row.valueRaw || 'part'}`}
				onclick={() => openPartDialog(row, 'view')}><ScanSearchIcon /></Button
			>
			<Button
				variant="ghost"
				size="icon-sm"
				aria-label={`Edit ${row.valueRaw || 'part'}`}
				onclick={() => openPartDialog(row, 'edit')}><PencilIcon /></Button
			>
			<RowActionsMenu
				id={row.id}
				label={row.valueRaw || 'part'}
				entityLabel="part"
				onDelete={() => {
					toDelete = row;
					deleteOpen = true;
				}}
			/>
		</div>
	{/if}
{/snippet}

<DataTable data={parts.data} {columns} rowActions={partActions} onAdd={openCreateDialog} />

{#if dialogOpen}
	<Dialog.Root bind:open={dialogOpen}>
		<Dialog.Content
			class="max-h-[calc(100vh-1rem)] min-h-[min(92vh,64rem)] max-w-[85rem] overflow-hidden sm:max-w-[85rem]"
		>
			<Dialog.Header>
				<Dialog.Title>
					{dialogMode === 'create' ? 'Add Part' : dialogMode === 'edit' ? 'Edit Part' : 'View Part'}
				</Dialog.Title>
			</Dialog.Header>
			{#if partLookups.ready}
				<PartDialogContent
					mode={dialogMode}
					part={selectedPart}
					lookups={partLookups.lookups}
					onSave={handleSave}
				/>
			{:else}
				<p class="py-8 text-center text-sm text-muted-foreground">Loading part data…</p>
			{/if}
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={closeDialog}>Close</Button>
				{#if dialogMode !== 'view'}
					<Button type="submit" form="part-dialog-form" disabled={!partLookups.ready}>Save</Button>
				{/if}
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
{/if}

<ConfirmDeleteDialog
	bind:open={deleteOpen}
	itemName={toDelete?.valueRaw ?? ''}
	entityLabel="part"
	onConfirm={() => toDelete && parts.remove(toDelete)}
/>
