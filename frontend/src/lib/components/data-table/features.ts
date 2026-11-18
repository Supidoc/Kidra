import {
	columnFilteringFeature,
	globalFilteringFeature,
	columnVisibilityFeature,
	createExpandedRowModel,
	createFilteredRowModel,
	createPaginatedRowModel,
	createSortedRowModel,
	filterFn_includesString,
	metaHelper,
	rowExpandingFeature,
	rowPaginationFeature,
	rowSelectionFeature,
	rowSortingFeature,
	sortFn_alphanumeric,
	sortFn_text,
	tableFeatures,
	type RowData
} from '@tanstack/svelte-table';
import type { ColumnType } from './columns.ts';

/** Typed `columnDef.meta` of every column built by `createColumns`. */
export type DataColumnMeta = {
	type: ColumnType;
	/** `false` when the column is never editable, otherwise the per-row check. */
	editable: false | ((row: RowData) => boolean);
};

// TanStack v9 only bundles the features registered here. `DataTable` and `TreeTable` share them,
// so columns from `createColumns` fit both; expanding only does something with `getSubRows`.
export const features = tableFeatures({
	columnFilteringFeature,
	globalFilteringFeature,
	columnVisibilityFeature,
	rowExpandingFeature,
	rowPaginationFeature,
	rowSelectionFeature,
	rowSortingFeature,
	expandedRowModel: createExpandedRowModel(),
	filteredRowModel: createFilteredRowModel(),
	paginatedRowModel: createPaginatedRowModel(),
	sortedRowModel: createSortedRowModel(),
	filterFns: { includesString: filterFn_includesString },
	sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
	columnMeta: metaHelper<DataColumnMeta>()
});

/** First generic argument of `ColumnDef`, `Column`, `Table` and `Row` for these tables. */
export type DataTableFeatures = typeof features;
