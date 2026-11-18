<script lang="ts" generics="T extends EditableRow">
	import {
		createTable,
		FlexRender,
		type ColumnDef,
		type ExpandedState,
		type PaginationState
	} from '@tanstack/svelte-table';
	import type { Snippet } from 'svelte';
	import { ChevronDownIcon, ChevronRightIcon } from '@lucide/svelte';
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
		/**
		 * Top-level rows. Every row in the tree is identified by its `id`, so ids must be unique
		 * across levels; PocketBase record ids are (15 random characters), even across collections.
		 */
		data: T[];
		/** Child rows of a row; `undefined` or empty for leaves. */
		getSubRows: (row: T) => T[] | undefined;
		/** Built with `createColumns`. The first column is indented and gets the expand toggle. */
		columns: ColumnDef<DataTableFeatures, T>[];
		/** Called with an edited row when it is saved with changes; `false` keeps editing. */
		onUpdate?: SaveRowHandler<T>;
		/** Extra buttons or menus at the end of every row. */
		rowActions?: Snippet<[RowActionContext<T>]>;
		/** Extra buttons on the right side of the toolbar. */
		toolbarActions?: Snippet;
		title?: string | Snippet;
		showSearch?: boolean;
		/**
		 * Makes rows selectable: called when a row is clicked (outside its own buttons, links and
		 * inputs) or activated with Enter/Space.
		 */
		onRowClick?: (row: T) => void;
		/** Id of the row highlighted as selected (with `onRowClick`). */
		selectedRowId?: string;
	};

	let {
		data,
		getSubRows,
		columns,
		onUpdate,
		rowActions,
		toolbarActions,
		title,
		showSearch = true,
		onRowClick,
		selectedRowId
	}: Props = $props();

	const edit = new TableEditState<T>({
		data: () => data,
		onUpdate: (row) => onUpdate?.(row)
	});
	setTableEditContext(edit);

	let search = $state('');
	let expanded = $state<ExpandedState>({});
	let pagination = $state<PaginationState>({ pageIndex: 0, pageSize: 25 });
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
		getSubRows: (row) => getSubRows(row)?.map((child) => edit.display(child)),
		getRowId: (row) => edit.rowId(row),
		// Search keeps matching rows together with their ancestors.
		filterFromLeafRows: true,
		// Drafts replace `data` on every keystroke; page and expansion must stay put while editing.
		autoResetPageIndex: false,
		autoResetExpanded: false,
		state: {
			get globalFilter() {
				return search;
			},
			get expanded() {
				return expanded;
			},
			get pagination() {
				return pagination;
			}
		},
		onExpandedChange: (updater) => {
			expanded = typeof updater === 'function' ? updater(expanded) : updater;
		},
		onPaginationChange: (updater) => {
			pagination = typeof updater === 'function' ? updater(pagination) : updater;
		}
	});

	const pageCount = $derived(table.getPageCount());
	// Stay on an existing page when rows disappear (e.g. after a collapse or delete).
	$effect(() => {
		if (pagination.pageIndex > 0 && pagination.pageIndex >= pageCount) {
			table.setPageIndex(Math.max(0, pageCount - 1));
		}
	});

	function changeSearch(query: string) {
		search = query;
		if (query) expanded = true;
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

{#snippet actions()}
	{#if edit.isEditing && edit.hasChanges}
		<Button size="sm" disabled={edit.saving} onclick={() => edit.save()}>Save</Button>
		<Button size="sm" variant="outline" onclick={() => edit.cancel()}>Cancel</Button>
	{/if}
	<Button size="sm" variant="outline" onclick={() => table.toggleAllRowsExpanded(true)}>
		Expand all
	</Button>
	<Button size="sm" variant="outline" onclick={() => table.toggleAllRowsExpanded(false)}>
		Collapse all
	</Button>
	{@render toolbarActions?.()}
{/snippet}

<div class="flex flex-col overflow-x-auto rounded-md border">
	<TableToolbar
		{title}
		search={showSearch ? search : undefined}
		onSearch={changeSearch}
		{actions}
		class="border-b"
	/>
	<div class="overflow-hidden">
		<Table.Root class="table-auto">
			<Table.Header>
				{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
					<Table.Row>
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
						class={onRowClick ? 'cursor-pointer' : undefined}
						{...clickableRowProps(
							!!selectedRowId && row.original.id === selectedRowId,
							onRowClick && (() => onRowClick(row.original))
						)}
						{@attach focusFirstEditor(isEditing)}
					>
						{#each row.getVisibleCells() as cell, index (cell.id)}
							<Table.Cell class={edit.isEdited(row.id, cell.column.id) ? 'bg-muted/40' : undefined}>
								{#if index === 0}
									<div class="flex items-center gap-1" style:padding-left="{row.depth * 1.5}rem">
										{#if row.getCanExpand()}
											<Button
												variant="ghost"
												size="icon"
												class="size-6 shrink-0"
												aria-label={row.getIsExpanded() ? 'Collapse row' : 'Expand row'}
												aria-expanded={row.getIsExpanded()}
												onclick={row.getToggleExpandedHandler()}
											>
												{#if row.getIsExpanded()}
													<ChevronDownIcon />
												{:else}
													<ChevronRightIcon />
												{/if}
											</Button>
										{:else}
											<span class="size-6 shrink-0"></span>
										{/if}
										<div class="min-w-0 flex-1">
											<FlexRender {cell} />
										</div>
									</div>
								{:else}
									<FlexRender {cell} />
								{/if}
							</Table.Cell>
						{/each}
						{#if showActions}
							<Table.Cell class="w-px px-2">
								<RowActions
									context={{ row: row.original, isNew: false, isEditing }}
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
