<script lang="ts">
	import { RefreshCwIcon } from '@lucide/svelte';
	import {
		createColumns,
		TreeTable,
		type RowActionContext
	} from '#lib/components/data-table/index.js';
	import ConfirmDeleteDialog from '#lib/components/confirm-delete-dialog.svelte';
	import { PreviewPanel, type PreviewSource } from '#lib/components/preview/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as ButtonGroup from '#lib/components/ui/button-group/index.js';
	import RowActionsMenu from '#lib/components/row-actions-menu.svelte';
	import { createCollection } from '#lib/data/collection.svelte.ts';
	import { FootprintModelState } from '#lib/data/footprint-model.svelte.ts';
	import { footprintPreviewUrl, syncLibraries } from '#lib/data/kicad-previews.ts';
	import { notify } from '#lib/notify.ts';
	import { buildLibraryTree, type TreeRow } from '#lib/data/library-tree.ts';
	import type { FootprintLibrariesRecord, FootprintsRecord } from '#lib/data/pocketbase-types.ts';

	type FootprintTreeRow = TreeRow<FootprintLibrariesRecord, FootprintsRecord>;

	const libraries = createCollection<FootprintLibrariesRecord>('footprintLibraries', {
		label: 'footprint library'
	});
	const footprints = createCollection<FootprintsRecord>('footprints', { label: 'footprint' });
	libraries.load();
	footprints.load();

	const columns = createColumns<FootprintTreeRow>([
		{ header: 'Name', accessor: 'name', type: 'text', searchable: true },
		{ header: 'Available', accessor: 'available', type: 'boolean' },
		{ header: 'Pads', accessor: 'padCount', type: 'number' },
		{ header: 'Description', accessor: 'description', type: 'text', searchable: true },
		{ header: 'Created', accessor: 'created', type: 'dateTime', dateFormat: 'MM/dd/yyyy HH:mm' },
		{ header: 'Updated', accessor: 'updated', type: 'dateTime', dateFormat: 'MM/dd/yyyy HH:mm' }
	]);

	const tree = $derived(buildLibraryTree(libraries.data, footprints.data));

	let selectedId = $state('');
	let view = $state<'2d' | '3d'>('2d');
	const selected = $derived(footprints.data.find((footprint) => footprint.id === selectedId));
	// The model is only downloaded while the 3D view is shown.
	const model = new FootprintModelState(
		() => selectedId,
		() => view === '3d'
	);
	const has3d = $derived(!!model.info?.exists);
	const show3d = $derived(view === '3d' && has3d);

	const preview = $derived.by((): PreviewSource | null => {
		if (!selected) return null;
		if (show3d) {
			return model.url
				? { kind: '3d', src: model.url, name: model.info?.filename ?? 'model.step' }
				: null;
		}
		const src = footprintPreviewUrl(selected);
		return src ? { kind: 'svg', src, name: `${selected.name}.svg`, background: 'dark' } : null;
	});
	const emptyText = $derived(
		!selected
			? 'Click a footprint to preview it.'
			: show3d
				? model.error || 'Loading 3D model…'
				: 'No preview available.'
	);

	let syncing = $state(false);
	const busy = $derived(syncing || libraries.loading || footprints.loading);
	async function reloadLibraries() {
		syncing = true;
		try {
			await syncLibraries();
			await Promise.all([libraries.load(), footprints.load()]);
			notify.success(
				'New or changed footprints may take a moment to show a preview.',
				'Libraries reloaded'
			);
		} catch (error) {
			notify.error(error instanceof Error ? error.message : String(error), 'Reload failed');
		} finally {
			syncing = false;
		}
	}

	let toDelete = $state<FootprintsRecord>();
	let deleteOpen = $state(false);
</script>

{#snippet rowActions({ row }: RowActionContext<FootprintTreeRow>)}
	{#if row.kind === 'item'}
		<RowActionsMenu
			id={row.id}
			label={row.name}
			entityLabel="footprint"
			onDelete={() => {
				toDelete = row;
				deleteOpen = true;
			}}
		/>
	{/if}
{/snippet}

{#snippet toolbarActions()}
	<Button
		size="icon-sm"
		variant="ghost"
		aria-label="Reload libraries from repository"
		title="Reload libraries from repository"
		disabled={busy}
		onclick={reloadLibraries}><RefreshCwIcon class={busy ? 'animate-spin' : undefined} /></Button
	>
{/snippet}

<div class="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]">
	<TreeTable
		data={tree}
		getSubRows={(row) => row.children}
		{columns}
		{rowActions}
		{toolbarActions}
		selectedRowId={selectedId}
		onRowClick={(row) => {
			if (row.kind === 'item') selectedId = row.id;
		}}
	/>
	<PreviewPanel
		class="xl:sticky xl:top-4"
		title={selected?.name ?? ''}
		detail={libraries.data.find((library) => library.id === selected?.library)?.name}
		placeholder="Select a footprint"
		{preview}
		{emptyText}
	>
		{#snippet actions()}
			{#if selected}
				<ButtonGroup.Root aria-label="Preview type">
					<Button
						size="sm"
						variant={show3d ? 'outline' : 'secondary'}
						aria-pressed={!show3d}
						onclick={() => (view = '2d')}>2D</Button
					>
					<Button
						size="sm"
						variant={show3d ? 'secondary' : 'outline'}
						aria-pressed={show3d}
						disabled={!has3d}
						title={has3d
							? model.info?.filename
							: model.info
								? 'No 3D model available'
								: 'Checking for a 3D model…'}
						onclick={() => (view = '3d')}>3D</Button
					>
				</ButtonGroup.Root>
			{/if}
		{/snippet}
		{#if selected?.padCount}
			<p class="text-sm text-muted-foreground">{selected.padCount} pads</p>
		{/if}
		{#if selected?.model3d}
			<p class="truncate text-xs text-muted-foreground" title={selected.model3d}>
				3D: {selected.model3d}
			</p>
		{/if}
	</PreviewPanel>
</div>

<ConfirmDeleteDialog
	bind:open={deleteOpen}
	itemName={toDelete?.name ?? ''}
	entityLabel="footprint"
	onConfirm={() => toDelete && footprints.remove(toDelete)}
/>
