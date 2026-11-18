<script lang="ts" generics="T extends EditableRow">
	import {
		createTable,
		FlexRender,
		type ColumnDef,
		type PaginationState
	} from '@tanstack/svelte-table';
	import type { Snippet } from 'svelte';
	import * as Table from '#lib/components/ui/table/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { features, type DataTableFeatures } from './features.ts';
	import { TableEditState, type EditableRow, type SaveRowHandler } from './edit-state.svelte.ts';
	import { setTableEditContext } from './context.ts';
	import { canEditRow, hasEditableColumns } from './columns.ts';
	import { focusFirstEditor } from './cells/focus.ts';
	import TableToolbar from './table-toolbar.svelte';
	import TablePagination from './table-pagination.svelte';
	import RowActions, { type RowActionContext } from './row-actions.svelte';
	import { clickableRowProps } from './row-click.ts';

	type Props = {
		/** Saved rows, identified by `id`. */
		data: T[];
		/** Built with `createColumns`. */
		columns: ColumnDef<DataTableFeatures, T>[];
		/** Called with an edited existing row when it is saved with changes; `false` keeps editing. */
		onUpdate?: SaveRowHandler<T>;
		/** Called with a row added through "Add row" when it is saved; `false` keeps editing. */
		onCreate?: SaveRowHandler<T>;
		/** Extra buttons or menus at the end of every row. */
		rowActions?: Snippet<[RowActionContext<T>]>;
		/** Enables "Add row": returns the new, unsaved row (its `id` may be empty). */
		createRow?: () => T;
		/** Shows an "Add" button that calls this instead of adding an inline row. */
		onAdd?: () => void;
		title?: string | Snippet;
		showSearch?: boolean;
		/**
		 * Makes rows selectable: called when a row is clicked (outside its own buttons, links and
		 * inputs) or activated with Enter/Space.
		 */
		onRowClick?: (row: T) => void;
		/** Id of the row highlighted as selected (with `onRowClick`). */
		selectedRowId?: string;
		/** `embedded`: no outer border, for tables inside forms and dialogs. */
		variant?: 'default' | 'embedded';
	};

	let {
		data,
		columns,
		onUpdate,
		onCreate,
		rowActions,
		createRow,
		onAdd,
		title,
		showSearch = true,
		onRowClick,
		selectedRowId,
		variant = 'default'
	}: Props = $props();

	const edit = new TableEditState<T>({
		data: () => data,
		onCreate: (row) => onCreate?.(row),
		onUpdate: (row) => onUpdate?.(row)
	});
	setTableEditContext(edit);

	let search = $state('');
	let pagination = $state<PaginationState>({ pageIndex: 0, pageSize: 25 });
	const embedded = $derived(variant === 'embedded');
	const editableColumns = $derived(hasEditableColumns(columns));
	const showActions = $derived(editableColumns || rowActions !== undefined);

	const table = createTable({
		features,
		get data() {
			return edit.rows;
		},
		get columns() {
			return columns;
		},
		getRowId: (row) => edit.rowId(row),
		// Drafts replace `data` on every keystroke; the page must stay where the user is editing.
		autoResetPageIndex: false,
		state: {
			get globalFilter() {
				return search;
			},
			get pagination() {
				return pagination;
			}
		},
		onPaginationChange: (updater) => {
			pagination = typeof updater === 'function' ? updater(pagination) : updater;
		}
	});

	const pageCount = $derived(table.getPageCount());
	// Stay on an existing page when rows disappear (e.g. after a delete on the last page).
	$effect(() => {
		if (pagination.pageIndex > 0 && pagination.pageIndex >= pageCount) {
			table.setPageIndex(Math.max(0, pageCount - 1));
		}
	});

	function addRow() {
		if (!createRow || edit.isEditing) return;
		edit.addRow(createRow());
		table.setPageIndex(0);
	}

	function changeSearch(query: string) {
		search = query;
		table.setPageIndex(0);
	}

	async function changePage(pageIndex: number) {
		const confirmSave = 'You have unsaved changes. Save them before changing page?';
		if (edit.hasChanges && window.confirm(confirmSave)) {
			await edit.save();
			// Saving failed: stay on the page with the edited row.
			if (edit.isEditing) return;
		} else edit.cancel();
		table.setPageIndex(pageIndex);
	}
</script>

{#snippet toolbarActions()}
	{#if onAdd}
		<Button size="sm" onclick={onAdd}>Add</Button>
	{:else if edit.isEditing && (createRow || edit.hasChanges)}
		<Button size="sm" disabled={edit.saving} onclick={() => edit.save()}>Save</Button>
		<Button size="sm" variant="outline" onclick={() => edit.cancel()}>Cancel</Button>
	{:else if createRow}
		<Button size="sm" onclick={addRow}>Add row</Button>
	{/if}
{/snippet}

<div class={['flex flex-col overflow-x-auto', !embedded && 'rounded-md border']}>
	<TableToolbar
		{title}
		search={showSearch ? search : undefined}
		onSearch={changeSearch}
		actions={toolbarActions}
		class={embedded ? undefined : 'border-b'}
	/>
	<div class={['overflow-hidden', embedded && 'rounded-md border-x border-b']}>
		<Table.Root class="table-auto">
			<Table.Header>
				{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
					<Table.Row class={embedded ? 'border-t' : undefined}>
						{#each headerGroup.headers as header (header.id)}
							<Table.Head colspan={header.colSpan}>
								{#if !header.isPlaceholder}
									<FlexRender {header} />
								{/if}
							</Table.Head>
						{/each}
						{#if showActions}
							<Table.Head class="w-px p-0" />
						{/if}
					</Table.Row>
				{/each}
			</Table.Header>
			<Table.Body>
				{#each table.getRowModel().rows as row (row.id)}
					{@const isEditing = edit.isEditingRow(row.id)}
					<Table.Row
						class={[edit.isNew(row.id) && 'bg-muted/50', onRowClick && 'cursor-pointer']}
						{...clickableRowProps(
							!!selectedRowId && row.original.id === selectedRowId,
							onRowClick && (() => onRowClick(row.original))
						)}
						{@attach focusFirstEditor(isEditing)}
					>
						{#each row.getVisibleCells() as cell (cell.id)}
							<Table.Cell class={edit.isEdited(row.id, cell.column.id) ? 'bg-muted/40' : undefined}>
								<FlexRender {cell} />
							</Table.Cell>
						{/each}
						{#if showActions}
							<Table.Cell class="w-px px-2">
								<RowActions
									context={{ row: row.original, isNew: edit.isNew(row.id), isEditing }}
									showEditControls={editableColumns}
									canEdit={canEditRow(columns, row.original)}
									saving={edit.saving}
									onEdit={() => edit.startEdit(row.original)}
									onConfirm={() => edit.save()}
									onRevert={() => edit.cancel()}
									actions={rowActions}
								/>
							</Table.Cell>
						{/if}
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell
							colspan={table.getVisibleLeafColumns().length + (showActions ? 1 : 0)}
							class="h-24 text-center"
						>
							No results.
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>
	{#if pageCount > 1}
		<TablePagination pageIndex={pagination.pageIndex} {pageCount} onPageChange={changePage} />
	{/if}
</div>
