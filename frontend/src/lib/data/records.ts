import type { IsoAutoDateString } from './pocketbase-types.ts';

/**
 * The system fields of a record that does not exist on the server yet.
 * PocketBase assigns the real `id`, `created` and `updated` when the record is created.
 */
export function unsavedRecordFields() {
	const now = new Date().toISOString() as IsoAutoDateString;
	return { id: '', created: now, updated: now };
}
