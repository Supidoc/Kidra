import type { FullListOptions, RecordService } from 'pocketbase';
import { notify } from '#lib/notify.ts';
import { pb } from './client.ts';
import { errorMessage } from './errors.ts';
import type { Collections } from './pocketbase-types.ts';

type CollectionOptions = {
	/** Used in error messages, e.g. "Failed to load category: …". Defaults to the collection name. */
	label?: string;
	listOptions?: FullListOptions;
};

/**
 * Local state plus CRUD operations for one PocketBase collection.
 *
 * Every operation reports its own failure through `notify.error` and resolves to
 * `true` on success or `false` on failure; it never throws.
 * `data` is updated with the server response after each successful write.
 */
export function createCollection<T extends { id: string }>(
	name: Collections,
	options: CollectionOptions = {}
) {
	const service = pb.collection(name) as unknown as RecordService<T>;
	const label = options.label ?? name;
	// Request the same relations on create/update as on load, so rows replaced
	// with the server response keep their `expand` data (e.g. `expand.category.name`).
	const writeOptions = options.listOptions?.expand
		? { expand: options.listOptions.expand }
		: undefined;

	let data = $state<T[]>([]);
	let loading = $state(false);

	function reportFailure(verb: string, error: unknown) {
		notify.error(`Failed to ${verb} ${label}: ${errorMessage(error)}`);
		return false;
	}

	/** Replaces `data` with all records of the collection. */
	async function load(): Promise<boolean> {
		loading = true;
		try {
			data = await service.getFullList(options.listOptions);
			return true;
		} catch (error) {
			return reportFailure('load', error);
		} finally {
			loading = false;
		}
	}

	/** Creates the rows on the server and appends the created records to `data`. */
	async function create(rows: T[]): Promise<boolean> {
		try {
			const created = await Promise.all(rows.map((row) => service.create(row, writeOptions)));
			data = [...data, ...created];
			return true;
		} catch (error) {
			return reportFailure('create', error);
		}
	}

	/** Saves the rows and replaces them in `data` with the server response. */
	async function update(rows: T[]): Promise<boolean> {
		try {
			await Promise.all(
				rows.map(async (row) => {
					const saved = await service.update(row.id, row, writeOptions);
					data = data.map((current) => (current.id === saved.id ? saved : current));
				})
			);
			return true;
		} catch (error) {
			return reportFailure('update', error);
		}
	}

	/** Deletes the row on the server and removes it from `data`. */
	async function remove(row: T): Promise<boolean> {
		try {
			await service.delete(row.id);
			data = data.filter((current) => current.id !== row.id);
			return true;
		} catch (error) {
			return reportFailure('delete', error);
		}
	}

	return {
		get data() {
			return data;
		},
		get loading() {
			return loading;
		},
		load,
		create,
		update,
		remove
	};
}
