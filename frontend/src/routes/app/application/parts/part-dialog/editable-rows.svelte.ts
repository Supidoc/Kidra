/**
 * Reactive list of editable table rows with per-row validation errors (keyed by row id).
 * An optional `normalize` is applied to every row that enters the list via set/add/update.
 */
export class EditableRows<T extends { id: string }> {
	rows = $state<T[]>([]);
	errors = $state<Record<string, string>>({});
	#normalize: (row: T) => T;

	constructor(options?: { normalize?: (row: T) => T }) {
		this.#normalize = options?.normalize ?? ((row) => row);
	}

	set(rows: T[]) {
		this.rows = rows.map((row) => this.#normalize(row));
		this.errors = {};
	}

	add(rows: T[]) {
		this.rows = [...rows.map((row) => this.#normalize(row)), ...this.rows];
	}

	update(rows: T[]) {
		this.rows = this.rows.map((row) => {
			const updated = rows.find((candidate) => candidate.id === row.id);
			return updated ? this.#normalize(updated) : row;
		});
	}

	remove(id: string) {
		this.rows = this.rows.filter((row) => row.id !== id);
		const nextErrors = { ...this.errors };
		delete nextErrors[id];
		this.errors = nextErrors;
	}

	/**
	 * Validates all rows: empty rows are skipped, incomplete rows get `incompleteMessage`,
	 * and rows sharing a key both get `duplicateMessage`. Replaces `errors` and returns
	 * `true` when there are no errors.
	 */
	validate(rules: {
		isEmpty: (row: T) => boolean;
		isComplete: (row: T) => boolean;
		keyOf: (row: T) => string;
		incompleteMessage: string;
		duplicateMessage: string;
	}): boolean {
		const nextErrors: Record<string, string> = {};
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local scratch map, not state
		const seen = new Map<string, string>();
		for (const row of this.rows.filter((candidate) => !rules.isEmpty(candidate))) {
			if (!rules.isComplete(row)) {
				nextErrors[row.id] = rules.incompleteMessage;
				continue;
			}
			const key = rules.keyOf(row);
			const duplicate = seen.get(key);
			if (duplicate !== undefined) {
				nextErrors[row.id] = rules.duplicateMessage;
				nextErrors[duplicate] = rules.duplicateMessage;
			} else {
				seen.set(key, row.id);
			}
		}
		this.errors = nextErrors;
		return Object.keys(nextErrors).length === 0;
	}
}
