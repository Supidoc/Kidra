import {
	createColumnHelper,
	renderComponent,
	renderSnippet,
	type ColumnDef,
	type RowData
} from '@tanstack/svelte-table';
import type { ComboboxGroup, ComboboxOption } from '#lib/components/combobox/index.js';
import type { DataTableFeatures } from './features.ts';
import { booleanCell, dateTimeCell, tagsCell, textCell } from './cells/display-cells.svelte';
import EditableCell from './cells/editable-cell.svelte';

/**
 * How a column displays and edits its value.
 * - `combobox`: stores an option id, displays its label, edits with a searchable combobox.
 * - `tags`: read-only chips. The value may be strings or records with a `name` (e.g. `expand.tags`).
 */
export type ColumnType = 'text' | 'number' | 'dateTime' | 'boolean' | 'combobox' | 'tags';

/** One column of a `DataTable`, turned into a TanStack column by `createColumns`. */
export type ColumnConfig<T extends RowData> = {
	/** Text shown in the table header. */
	header: string;
	/** Property path (e.g. `'expand.category.name'`) or function that reads the value. */
	accessor: string | ((row: T) => unknown);
	/** Column id. Defaults to the string accessor; required with an accessor function. */
	id?: string;
	type: ColumnType;
	/**
	 * Whether the cell can be edited, for all rows or per row.
	 * Editable columns need a top-level string accessor, which is also their id.
	 */
	editable?: boolean | ((row: T) => boolean);
	/** Includes this column in the table-wide search. */
	searchable?: boolean;
	/** date-fns format for `dateTime` columns. Defaults to the locale format. */
	dateFormat?: string;
	/** Flat options for `combobox` columns. */
	options?: ComboboxOption[];
	/** Grouped options for `combobox` columns. */
	groups?: ComboboxGroup[];
	/** Trigger placeholder of the `combobox` editor. */
	placeholder?: string;
	/** Search placeholder of the `combobox` editor. */
	searchPlaceholder?: string;
	/**
	 * Path to the label of a `combobox` value, e.g. `'expand.distributor.name'`. Used for display,
	 * search and sorting; falls back to the matching option label.
	 */
	labelAccessor?: string;
};

/** Builds TanStack column definitions for `DataTable`. */
export function createColumns<T extends RowData>(
	columns: ColumnConfig<T>[]
): ColumnDef<DataTableFeatures, T>[] {
	const helper = createColumnHelper<DataTableFeatures, T>();
	return columns.map((config, index) => {
		const id = columnId(config, index);
		const readRaw = (row: T) =>
			typeof config.accessor === 'function'
				? config.accessor(row)
				: getNestedValue(row, config.accessor);
		const editable = config.editable ?? false;

		return helper.accessor((row) => searchValue(config, row, readRaw(row)), {
			id,
			header: config.header,
			enableGlobalFilter: config.searchable ?? false,
			meta: {
				type: config.type,
				editable: editable === false ? false : (row) => isEditable(config, row as T)
			},
			cell: ({ row }) => {
				const raw = readRaw(row.original);
				if (!isEditable(config, row.original)) return renderDisplay(config, row.original, raw);
				return renderComponent(EditableCell, {
					rowId: row.id,
					field: id,
					type: config.type,
					value: raw,
					// Resolved from the current id, so the label follows a new selection while editing.
					label: config.type === 'combobox' ? optionLabel(config, raw) : undefined,
					options: config.options,
					groups: config.groups,
					placeholder: config.placeholder,
					searchPlaceholder: config.searchPlaceholder
				});
			}
		});
	});
}

/** Whether `config` is editable for `row`. */
export function isEditable<T extends RowData>(config: ColumnConfig<T>, row: T): boolean {
	const { editable = false } = config;
	return typeof editable === 'function' ? editable(row) : editable;
}

/** Whether any of the columns is editable, at least for some rows. */
export function hasEditableColumns<T extends RowData>(columns: ColumnDef<DataTableFeatures, T>[]) {
	return columns.some((column) => column.meta?.editable);
}

/** Whether `row` has at least one editable cell. */
export function canEditRow<T extends RowData>(columns: ColumnDef<DataTableFeatures, T>[], row: T) {
	return columns.some((column) => column.meta?.editable && column.meta.editable(row));
}

/** Reads a dotted property path such as `'expand.category.name'`; `undefined` when missing. */
export function getNestedValue(value: unknown, path: string): unknown {
	return path.split('.').reduce<unknown>((current, key) => {
		if (current == null || typeof current !== 'object') return undefined;
		return (current as Record<string, unknown>)[key];
	}, value);
}

/** Sorted names of a tags value: strings or records with a `name`. Anything else yields `[]`. */
export function tagNames(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => {
			if (typeof item === 'string') return item;
			if (item && typeof item === 'object' && 'name' in item) return String(item.name ?? '');
			return '';
		})
		.filter(Boolean)
		.sort((a, b) => a.localeCompare(b));
}

/** Label of the option with id `value` (flat or grouped); the id itself when no option matches. */
export function optionLabel(
	config: Pick<ColumnConfig<RowData>, 'options' | 'groups'>,
	value: unknown
): string {
	if (value == null || value === '') return '';
	const id = String(value);
	const match =
		config.options?.find((option) => option.id === id) ??
		config.groups?.flatMap((group) => group.options).find((option) => option.id === id);
	return match?.label ?? id;
}

function columnId<T extends RowData>(config: ColumnConfig<T>, index: number): string {
	const editable = config.editable !== undefined && config.editable !== false;
	if (typeof config.accessor === 'function') {
		if (editable) throw new Error(`Editable column "${config.header}" needs a string accessor.`);
		return config.id ?? `column-${index}`;
	}
	if (editable && (config.accessor.includes('.') || (config.id && config.id !== config.accessor))) {
		throw new Error(`Editable column "${config.header}" needs a top-level accessor as its id.`);
	}
	return config.id ?? config.accessor;
}

/** The value TanStack searches and sorts by: the label a user sees, not a stored id. */
function searchValue<T extends RowData>(config: ColumnConfig<T>, row: T, raw: unknown): unknown {
	if (config.type === 'tags') return tagNames(raw).join(' ');
	if (config.type !== 'combobox') return raw;
	const label = config.labelAccessor ? getNestedValue(row, config.labelAccessor) : undefined;
	return label != null && label !== '' ? String(label) : optionLabel(config, raw);
}

function renderDisplay<T extends RowData>(config: ColumnConfig<T>, row: T, raw: unknown) {
	switch (config.type) {
		case 'tags':
			return renderSnippet(tagsCell, tagNames(raw));
		case 'boolean':
			return renderSnippet(booleanCell, Boolean(raw));
		case 'dateTime':
			return renderSnippet(dateTimeCell, { value: raw, format: config.dateFormat });
		case 'combobox':
			return renderSnippet(textCell, String(searchValue(config, row, raw)));
		default:
			return renderSnippet(textCell, raw == null ? '' : String(raw));
	}
}
