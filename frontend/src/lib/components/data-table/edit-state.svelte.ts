import { SvelteSet } from 'svelte/reactivity';

/** Row key of an unsaved new row whose `id` is still empty. Only one new row exists at a time. */
export const NEW_ROW_KEY = 'new-row';

/** Rows of an editable table are identified by `id`. */
export type EditableRow = { id: string };

/**
 * Writes a saved row. Return `false` (or resolve to it) when the write failed: the row then stays
 * in edit mode with the user's changes.
 */
export type SaveRowHandler<T> = (row: T) => void | boolean | Promise<void | boolean>;

export type TableEditOptions<T extends EditableRow> = {
	/** The saved rows. Read on every access, so pass a getter over reactive state. */
	data: () => T[];
	/** Receives a new row (with its original, possibly empty `id`) on save. */
	onCreate?: SaveRowHandler<T>;
	/** Receives an existing row on save, only when one of its cells changed. */
	onUpdate?: SaveRowHandler<T>;
};

/** The part of the edit state that editable cells use. */
export interface TableEditContext {
	isEditingRow(rowId: string): boolean;
	setCell(rowId: string, columnId: string, value: unknown): void;
	cancel(): void;
}

/**
 * Inline row editing for a table: one row at a time is edited on a draft copy of that row and
 * written back through `onCreate`/`onUpdate` on `save()`.
 */
export class TableEditState<T extends EditableRow> implements TableEditContext {
	/** Key of the row being edited, or `null`. */
	editingRowId = $state<string | null>(null);
	/** Key of the unsaved new row, or `null`. */
	newRowId = $state<string | null>(null);
	/** A save is waiting for `onCreate`/`onUpdate`. */
	saving = $state(false);

	#draft = $state<T | null>(null);
	#original: T | null = null;
	#edited = new SvelteSet<string>();
	#options: TableEditOptions<T>;

	constructor(options: TableEditOptions<T>) {
		this.#options = options;
	}

	/** Rows to display: the data with the edited row replaced by its draft (a new row on top). */
	readonly rows: T[] = $derived.by(() => {
		const data = this.#options.data();
		if (!this.#draft) return data;
		if (this.newRowId !== null) {
			// A synchronous `onCreate` may already have added the row under the same id.
			const newRowId = this.newRowId;
			return [this.#draft, ...data.filter((row) => this.rowId(row) !== newRowId)];
		}
		return data.map((row) => this.display(row));
	});

	/** The draft of `row` while it is being edited, otherwise `row`. Use it for nested rows. */
	display(row: T): T {
		if (this.#draft && this.rowId(row) === this.editingRowId) return this.#draft;
		return row;
	}

	get isEditing(): boolean {
		return this.editingRowId !== null;
	}

	/** Whether saving now would create or update a row. */
	get hasChanges(): boolean {
		return this.newRowId !== null || this.#edited.size > 0;
	}

	/** Row key used by TanStack's `getRowId`: the record id, or `NEW_ROW_KEY` while it is empty. */
	rowId(row: T): string {
		return row.id || NEW_ROW_KEY;
	}

	isEditingRow(rowId: string): boolean {
		return this.editingRowId === rowId;
	}

	isNew(rowId: string): boolean {
		return this.newRowId === rowId;
	}

	isEdited(rowId: string, columnId: string): boolean {
		return this.#edited.has(cellKey(rowId, columnId));
	}

	/** Starts editing a saved row. Ignored while another row is being edited. */
	startEdit(row: T): void {
		if (this.isEditing) return;
		this.#begin(row);
	}

	/** Puts `row` on top of the table and starts editing it. Ignored while a row is being edited. */
	addRow(row: T): void {
		if (this.isEditing) return;
		this.#begin(row);
		this.newRowId = this.rowId(row);
	}

	/** Writes a cell of the edited row; it counts as edited while it differs from the original. */
	setCell(rowId: string, columnId: string, value: unknown): void {
		if (!this.#draft || !this.#original || rowId !== this.editingRowId) return;
		const original = readField(this.#original, columnId);
		const changed = !valuesEqual(value, original);
		if (changed) this.#edited.add(cellKey(rowId, columnId));
		else this.#edited.delete(cellKey(rowId, columnId));
		this.#draft = { ...this.#draft, [columnId]: changed ? value : original };
	}

	/**
	 * Hands the row to `onCreate` (new) or `onUpdate` (changed) and ends editing, unless the
	 * handler returns `false`: then the row stays in edit mode so the user keeps the changes.
	 */
	async save(): Promise<void> {
		const row = this.#draft;
		const rowId = this.editingRowId;
		if (!row || this.saving) return;
		const isNew = this.newRowId !== null;
		if (!isNew && this.#edited.size === 0) {
			this.#reset();
			return;
		}
		this.saving = true;
		try {
			const handler = isNew ? this.#options.onCreate : this.#options.onUpdate;
			const result = await handler?.(row);
			// The user may have cancelled and started another edit while waiting.
			if (result !== false && this.editingRowId === rowId) this.#reset();
		} finally {
			this.saving = false;
		}
	}

	/** Ends editing and drops the draft. */
	cancel(): void {
		this.#reset();
	}

	#begin(row: T) {
		this.#draft = row;
		this.#original = row;
		this.#edited.clear();
		this.editingRowId = this.rowId(row);
	}

	#reset() {
		this.#draft = null;
		this.#original = null;
		this.#edited.clear();
		this.editingRowId = null;
		this.newRowId = null;
	}
}

function cellKey(rowId: string, columnId: string) {
	return `${rowId}:${columnId}`;
}

function readField(row: object, field: string): unknown {
	return (row as Record<string, unknown>)[field];
}

function valuesEqual(left: unknown, right: unknown) {
	if (Object.is(left, right)) return true;
	if (left == null && right == null) return true;
	if (left instanceof Date && right instanceof Date) return left.getTime() === right.getTime();
	return false;
}
