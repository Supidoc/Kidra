import { uploadAttachment, type AttachmentDraft } from './attachments.ts';
import { pb } from './client.ts';
import type {
	AttachmentsRecord,
	DistributorPartsRecord,
	PartsRecord,
	RatingsRecord,
	TagsRecord
} from './pocketbase-types.ts';

/** A rating row of the part form. Ids starting with `new-` are not saved yet. */
export type RatingDraft = Pick<RatingsRecord, 'id' | 'key' | 'value'>;

/** A distributor part row of the part form. Ids starting with `new-` are not saved yet. */
export type DistributorPartsDraft = Pick<
	DistributorPartsRecord,
	'id' | 'distributor' | 'distributorNumber'
>;

export type { AttachmentDraft };

/** A tag chip of the part form. Ids starting with `new-` are not saved yet. */
export type TagDraft = { id: string; name: string };

/** What the part dialog submits. */
export type PartDraft = {
	/** The form output. `id` is empty for a new part. */
	part: PartsRecord;
	ratings: RatingDraft[];
	distributorParts: DistributorPartsDraft[];
	/**
	 * The attachments linked to the part. `savePart` writes the record id into a draft once
	 * its file is uploaded, so a retry after a failed save does not upload it again.
	 */
	attachments: AttachmentDraft[];
	/** Id of the attachment that is the part's primary datasheet (KiCad's `Datasheet`), or ''. */
	primaryDatasheetId: string;
	tags: TagDraft[];
	/** Called with the uploaded fraction (0–1) of each attachment file while it uploads. */
	onUploadProgress?: (attachment: AttachmentDraft, fraction: number) => void;
};

export type SavePartInput = PartDraft & {
	/** The part as it was before editing (null when creating), used to find orphaned rows. */
	previous: PartsRecord | null;
	/** All tags on the server; new tags with a matching name (case-insensitive) reuse them. */
	existingTags: TagsRecord[];
	/** Records as they are on the server. Rows that did not change are not sent again. */
	saved: {
		ratings: RatingsRecord[];
		distributorParts: DistributorPartsRecord[];
		attachments: AttachmentsRecord[];
	};
};

type PartCollection = 'ratings' | 'distributorParts' | 'tags' | 'attachments' | 'parts';
type Body = Record<string, unknown>;

export type PartSaveOperation =
	| { collection: PartCollection; action: 'create'; body: Body }
	| { collection: PartCollection; action: 'update'; id: string; body: Body }
	| { collection: PartCollection; action: 'delete'; id: string };

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** A random record id in PocketBase's default format (15 chars of `[a-z0-9]`). */
export function newRecordId(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(15));
	return Array.from(bytes, (byte) => ID_ALPHABET[byte % ID_ALPHABET.length]).join('');
}

function isUnsaved(id: string) {
	return !id || id.startsWith('new-');
}

/** Whether every field of `body` has the same value in the saved record. */
function isUnchanged(body: Body, saved: Body | undefined) {
	return saved !== undefined && Object.entries(body).every(([key, value]) => saved[key] === value);
}

/**
 * Writes a row: create it with a fresh id when it is new, update it when it differs from
 * the saved record, and skip it (`operation: null`) when nothing changed.
 */
function upsert(
	collection: PartCollection,
	id: string,
	body: Body,
	newId: () => string,
	savedRecords: { id: string }[]
): { id: string; operation: PartSaveOperation | null } {
	if (!isUnsaved(id)) {
		const saved = savedRecords.find((record) => record.id === id);
		if (isUnchanged(body, saved)) return { id, operation: null };
		return { id, operation: { collection, action: 'update', id, body } };
	}
	const createdId = newId();
	return {
		id: createdId,
		operation: { collection, action: 'create', body: { id: createdId, ...body } }
	};
}

/** PocketBase drops `undefined` from JSON, so it would not clear a field. `null` does. */
function withNulls(record: Body): Body {
	return Object.fromEntries(
		Object.entries(record).map(([key, value]) => [key, value === undefined ? null : value])
	);
}

/**
 * Plans the writes for saving a part, without sending anything.
 * Order: attachments, ratings, distributor parts, new tags, the part, then deletion of
 * ratings and distributor parts that `previous` referenced but the part no longer does.
 * Empty rating and distributor part rows are skipped; unchanged existing rows are not sent;
 * tags are deduplicated.
 *
 * Attachments are only linked: existing ones get their metadata (name, URL, kind,
 * description) updated when it changed, link-only drafts (a URL, no file) are created, and
 * none is ever deleted, since they are shared library records. Drafts with a file must be
 * uploaded first (see {@link savePart}); unsaved ones are skipped here. `parts.datasheet` is
 * the primary datasheet when it is among the linked attachments, else empty.
 *
 * @param newId generates ids for records to create, so the part can reference them.
 */
export function planPartSave(input: SavePartInput, newId: () => string = newRecordId) {
	const operations: PartSaveOperation[] = [];

	const attachmentIds: string[] = [];
	let datasheetId = '';
	for (const attachment of input.attachments) {
		if (isUnsaved(attachment.id) && (attachment.file || !attachment.url.trim())) continue;
		const body: Body = {
			name: attachment.name.trim(),
			url: attachment.url.trim(),
			kind: attachment.kind,
			description: attachment.description.trim()
		};
		const saved = upsert('attachments', attachment.id, body, newId, input.saved.attachments);
		if (attachmentIds.includes(saved.id)) continue;
		attachmentIds.push(saved.id);
		if (saved.operation) operations.push(saved.operation);
		if (input.primaryDatasheetId && attachment.id === input.primaryDatasheetId) {
			datasheetId = saved.id;
		}
	}

	const ratingIds: string[] = [];
	for (const rating of input.ratings) {
		const key = rating.key.trim();
		const value = rating.value.trim();
		if (!key || !value) continue;
		const saved = upsert('ratings', rating.id, { key, value }, newId, input.saved.ratings);
		ratingIds.push(saved.id);
		if (saved.operation) operations.push(saved.operation);
	}

	const distributorPartIds: string[] = [];
	for (const row of input.distributorParts) {
		const distributor = row.distributor.trim();
		const distributorNumber = row.distributorNumber.trim();
		if (!distributor || !distributorNumber) continue;
		const saved = upsert(
			'distributorParts',
			row.id,
			{ distributor, distributorNumber },
			newId,
			input.saved.distributorParts
		);
		distributorPartIds.push(saved.id);
		if (saved.operation) operations.push(saved.operation);
	}

	const tagIdsByName = new Map(
		input.existingTags
			.filter((tag) => tag.name?.trim())
			.map((tag) => [tag.name!.trim().toLowerCase(), tag.id])
	);
	const tagIds = new Set<string>();
	for (const tag of input.tags) {
		const name = tag.name.trim();
		if (!name) continue;
		let id = isUnsaved(tag.id) ? tagIdsByName.get(name.toLowerCase()) : tag.id;
		if (!id) {
			id = newId();
			tagIdsByName.set(name.toLowerCase(), id);
			operations.push({ collection: 'tags', action: 'create', body: { id, name } });
		}
		tagIds.add(id);
	}

	const { id } = input.part;
	// PocketBase sets the system fields itself.
	const fields: Body = { ...input.part };
	delete fields.id;
	delete fields.created;
	delete fields.updated;
	const partBody = withNulls({
		...fields,
		ratings: ratingIds,
		distributorParts: distributorPartIds,
		tags: [...tagIds],
		attachments: attachmentIds,
		datasheet: datasheetId
	});
	const partId = id || newId();
	operations.push(
		id
			? { collection: 'parts', action: 'update', id, body: partBody }
			: { collection: 'parts', action: 'create', body: { id: partId, ...partBody } }
	);

	const orphans = (previousIds: string[] | undefined, keptIds: string[]) =>
		(previousIds ?? []).filter((previousId) => !keptIds.includes(previousId));
	for (const ratingId of orphans(input.previous?.ratings, ratingIds)) {
		operations.push({ collection: 'ratings', action: 'delete', id: ratingId });
	}
	for (const distributorPartId of orphans(input.previous?.distributorParts, distributorPartIds)) {
		operations.push({ collection: 'distributorParts', action: 'delete', id: distributorPartId });
	}

	return { partId, operations };
}

/**
 * Saves a part in two steps:
 * 1. Uploads every attachment draft that has a file but no saved id, one request each (with
 *    progress through `input.onUploadProgress`). The new record id is written back into the
 *    draft, so a retry does not upload it again.
 * 2. Saves the part with its ratings, distributor parts, new tags and attachment links in
 *    one atomic PocketBase batch: either all of it is written or nothing is.
 *
 * If the batch fails, the uploaded attachments stay as library records (they show up in the
 * attachment picker) and the save can simply be retried.
 *
 * Needs the Batch API enabled in the PocketBase settings. Its "max requests" setting
 * (default 50) limits how many rows one save can write (see {@link planPartSave}).
 *
 * @returns the saved part record.
 * @throws the upload error or the PocketBase error when the batch fails.
 */
export async function savePart(input: SavePartInput): Promise<PartsRecord> {
	let primaryDatasheetId = input.primaryDatasheetId;
	const uploaded: AttachmentsRecord[] = [];
	for (const attachment of input.attachments) {
		if (!attachment.file || !isUnsaved(attachment.id)) continue;
		const record = await uploadAttachment(attachment, (fraction) =>
			input.onUploadProgress?.(attachment, fraction)
		);
		if (attachment.id && attachment.id === primaryDatasheetId) primaryDatasheetId = record.id;
		attachment.id = record.id;
		uploaded.push(record);
	}

	const { operations } = planPartSave({
		...input,
		primaryDatasheetId,
		saved: { ...input.saved, attachments: [...input.saved.attachments, ...uploaded] }
	});
	const batch = pb.createBatch();
	for (const operation of operations) {
		const collection = batch.collection(operation.collection);
		if (operation.action === 'create') collection.create(operation.body);
		else if (operation.action === 'update') collection.update(operation.id, operation.body);
		else collection.delete(operation.id);
	}
	const results = await batch.send();
	const partIndex = operations.findIndex((operation) => operation.collection === 'parts');
	return results[partIndex].body as PartsRecord;
}
