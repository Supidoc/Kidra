import { notify } from '#lib/notify.ts';
import { pb } from './client.ts';
import { errorMessage } from './errors.ts';
import type { Collections } from './pocketbase-types.ts';

export type CollectionStats<T> = { count: number; latest: T | null };

/**
 * Number of records in a collection and the most recently created one.
 * Never throws: on failure it shows an error toast and returns `{ count: 0, latest: null }`.
 */
export async function getCollectionStats<T>(collection: Collections): Promise<CollectionStats<T>> {
	try {
		const result = await pb.collection(collection).getList<T>(1, 1, { sort: '-created' });
		return { count: result.totalItems, latest: result.items[0] ?? null };
	} catch (error) {
		notify.error(errorMessage(error), `Failed to load ${collection} stats`);
		return { count: 0, latest: null };
	}
}
