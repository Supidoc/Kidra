import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { PreviewSource } from '#lib/components/preview/index.js';
import {
	attachmentFileUrl,
	downloadAttachment,
	fileExtension,
	guessAttachmentKind,
	nameWithoutExtension,
	previewKind,
	type AttachmentKind
} from '#lib/data/attachments.ts';
import type { AttachmentsRecord, PartsRecord } from '#lib/data/pocketbase-types.ts';
import type { AttachmentDraft } from '../types.ts';

/** An attachment row of the part dialog. `key` stays the same when the id changes on upload. */
export type AttachmentRow = AttachmentDraft & { key: string };

/** The preview of a file, link or saved attachment (`localUrl` is the object URL of `file`). */
export function attachmentPreview(
	item: { file?: File | string | null; url?: string; id: string },
	record: AttachmentsRecord | undefined,
	localUrl: string
): PreviewSource | null {
	let src = '';
	let name = '';
	let mime = '';
	if (item.file instanceof File) {
		src = localUrl;
		name = item.file.name;
		mime = item.file.type;
	} else if (record?.file) {
		src = attachmentFileUrl(record);
		name = record.file;
	} else if (item.url) {
		src = item.url;
		name = item.url.split(/[?#]/)[0].split('/').pop() || item.url;
	}
	if (!src) return null;
	const kind = previewKind(name, mime);
	return { kind: kind === 'image' && fileExtension(name) === 'svg' ? 'svg' : kind, src, name };
}

/**
 * State of the part's attachments: the rows to save, the primary datasheet, the row selected
 * for preview, adding files / URLs / existing records, per-row upload progress and the
 * existing-attachment picker.
 *
 * Must be constructed during component initialisation: the constructor registers an
 * `$effect` that creates an object URL for the selected row's local file (`localPreviewUrl`)
 * and revokes it when the selection changes or the component is destroyed.
 *
 * Methods meant to be used as event handlers are arrow-function properties, so they can be
 * passed directly as callbacks. A pending URL download is discarded on `reset`.
 *
 * `rows` are handed to `savePart` as they are: it writes the uploaded record id into each
 * row (the `$state` proxy), so a retry after a failed save does not upload again.
 */
export class AttachmentListState {
	#getAttachments: () => AttachmentsRecord[];
	/** Bumped on `reset`, so a pending download can detect it is stale. */
	#token = 0;
	#nextKey = 0;

	rows = $state<AttachmentRow[]>([]);
	/** Key of the row that is the primary datasheet, or ''. */
	primaryKey = $state('');
	/** Key of the entry shown in the preview (an attachment row or an extra panel entry). */
	selectedKey = $state('');
	/** Upload progress (0–1) by row key, while saving. */
	readonly progress = new SvelteMap<string, number>();
	error = $state('');
	downloadUrl = $state('');
	isDownloading = $state(false);
	localPreviewUrl = $state('');

	pickerOpen = $state(false);
	search = $state('');
	kindFilter = $state<AttachmentKind | 'all'>('all');
	/** Ids checked in the picker. */
	readonly picked = new SvelteSet<string>();
	/** The record previewed in the picker. */
	candidate = $state<AttachmentsRecord | null>(null);

	#selected = $derived(this.rows.find((row) => row.key === this.selectedKey) ?? null);

	#filtered = $derived.by(() => {
		const query = this.search.trim().toLowerCase();
		const linked = this.rows.map((row) => row.id);
		return this.#getAttachments().filter(
			(item) =>
				!linked.includes(item.id) &&
				(this.kindFilter === 'all' || (item.kind || 'other') === this.kindFilter) &&
				(!query ||
					`${item.name ?? ''} ${item.url ?? ''} ${item.description ?? ''} ${item.file ?? ''}`
						.toLowerCase()
						.includes(query))
		);
	});

	constructor(getAttachments: () => AttachmentsRecord[]) {
		this.#getAttachments = getAttachments;
		$effect(() => {
			const file = this.#selected?.file;
			if (!(file instanceof File)) {
				this.localPreviewUrl = '';
				return;
			}
			const url = URL.createObjectURL(file);
			this.localPreviewUrl = url;
			return () => URL.revokeObjectURL(url);
		});
	}

	#key() {
		return `attachment-${++this.#nextKey}`;
	}

	#record(id: string) {
		return id ? this.#getAttachments().find((item) => item.id === id) : undefined;
	}

	#rowFromRecord(record: AttachmentsRecord): AttachmentRow {
		return {
			key: this.#key(),
			id: record.id,
			name: record.name ?? '',
			url: record.url ?? '',
			kind: record.kind || 'other',
			description: record.description ?? '',
			file: null
		};
	}

	#newRow(fields: Pick<AttachmentDraft, 'name' | 'url' | 'kind' | 'file'>): AttachmentRow {
		const key = this.#key();
		return { key, id: `new-${key}`, description: '', ...fields };
	}

	/** Keeps the primary datasheet valid: an existing datasheet row, else the first one. */
	#ensurePrimary() {
		const primary = this.rows.find((row) => row.key === this.primaryKey);
		if (primary?.kind === 'datasheet') return;
		this.primaryKey = this.rows.find((row) => row.kind === 'datasheet')?.key ?? '';
	}

	#add(rows: AttachmentRow[]) {
		if (!rows.length) return;
		this.rows.push(...rows);
		this.selectedKey = rows[0].key;
		this.#ensurePrimary();
	}

	get selected() {
		return this.#selected;
	}

	/** Records matching the picker's search and kind filter, without those already linked. */
	get filtered() {
		return this.#filtered;
	}

	/** The id of the primary datasheet row as it is now ('' when there is none). */
	get primaryDatasheetId() {
		return this.rows.find((row) => row.key === this.primaryKey)?.id ?? '';
	}

	/** The saved record behind a row, if any. */
	recordFor(row: AttachmentDraft) {
		return this.#record(row.id);
	}

	/** Preview of a row (the selected row's local file uses `localPreviewUrl`). */
	previewFor(row: AttachmentRow | null): PreviewSource | null {
		if (!row) return null;
		return attachmentPreview(
			row,
			this.#record(row.id),
			row.key === this.selectedKey ? this.localPreviewUrl : ''
		);
	}

	/** Preview of a record in the picker. */
	previewForRecord(record: AttachmentsRecord | null): PreviewSource | null {
		return record ? attachmentPreview(record, record, '') : null;
	}

	/** Loads the attachments linked to `part` (or clears them) and resets everything else. */
	reset(part: PartsRecord | null) {
		this.#token++;
		this.isDownloading = false;
		const ids = part?.attachments?.length
			? part.attachments
			: part?.datasheet
				? [part.datasheet]
				: [];
		this.rows = ids
			.map((id) => this.#record(id))
			.filter((record) => record !== undefined)
			.map((record) => this.#rowFromRecord(record));
		this.primaryKey = this.rows.find((row) => row.id === part?.datasheet)?.key ?? '';
		this.selectedKey = this.primaryKey || this.rows[0]?.key || '';
		this.progress.clear();
		this.error = '';
		this.downloadUrl = '';
		this.pickerOpen = false;
		this.picked.clear();
		this.candidate = null;
	}

	/** Adds local files; the kind is guessed from each file (the user can change it). */
	addFiles = (files: Iterable<File> | null | undefined) => {
		if (!files) return;
		const rows: AttachmentRow[] = [];
		let hasDatasheet = this.rows.some((row) => row.kind === 'datasheet');
		for (const file of files) {
			const kind = guessAttachmentKind(file.name, file.type, hasDatasheet);
			hasDatasheet ||= kind === 'datasheet';
			rows.push(this.#newRow({ name: nameWithoutExtension(file.name), url: '', kind, file }));
		}
		this.error = '';
		this.#add(rows);
	};

	handleFileInput = (event: Event) => {
		const input = event.currentTarget as HTMLInputElement;
		this.addFiles(input.files ? [...input.files] : null);
		input.value = '';
	};

	/** Downloads `downloadUrl` through the server and adds it as a file. */
	downloadFromUrl = async () => {
		const token = ++this.#token;
		this.error = '';
		this.isDownloading = true;
		try {
			const url = this.downloadUrl.trim();
			if (!url) throw new Error('Enter a URL.');
			const file = await downloadAttachment(url);
			if (token !== this.#token) return;
			const kind = guessAttachmentKind(
				file.name,
				file.type,
				this.rows.some((row) => row.kind === 'datasheet')
			);
			this.#add([this.#newRow({ name: nameWithoutExtension(file.name), url, kind, file })]);
			this.downloadUrl = '';
		} catch (error) {
			if (token !== this.#token) return;
			this.error = error instanceof Error ? error.message : 'Failed to download the file.';
		} finally {
			if (token === this.#token) this.isDownloading = false;
		}
	};

	/** Adds `downloadUrl` as a link without a stored file. */
	addLink = () => {
		const url = this.downloadUrl.trim();
		if (!URL.canParse(url)) {
			this.error = 'Enter a valid URL.';
			return;
		}
		const name = nameWithoutExtension(url.split(/[?#]/)[0].split('/').pop() || url);
		const kind = guessAttachmentKind(
			url,
			'',
			this.rows.some((row) => row.kind === 'datasheet')
		);
		this.#add([this.#newRow({ name, url, kind, file: null })]);
		this.downloadUrl = '';
		this.error = '';
	};

	/** Unlinks a row from the part (the attachment record itself is kept). */
	remove = (key: string) => {
		const index = this.rows.findIndex((row) => row.key === key);
		if (index < 0) return;
		this.rows.splice(index, 1);
		this.progress.delete(key);
		if (this.selectedKey === key) {
			this.selectedKey = (this.rows[index] ?? this.rows[index - 1])?.key ?? '';
		}
		this.#ensurePrimary();
	};

	select = (key: string) => {
		this.selectedKey = key;
	};

	/** Makes a datasheet row the primary datasheet. */
	setPrimary = (key: string) => {
		if (this.rows.find((row) => row.key === key)?.kind === 'datasheet') this.primaryKey = key;
	};

	update(key: string, field: 'name' | 'url' | 'description', value: string) {
		const row = this.rows.find((item) => item.key === key);
		if (row) row[field] = value;
	}

	setKind(key: string, kind: AttachmentKind) {
		const row = this.rows.find((item) => item.key === key);
		if (!row) return;
		row.kind = kind;
		this.#ensurePrimary();
	}

	/** Records the upload progress of a row; pass as `PartDraft.onUploadProgress`. */
	onUploadProgress = (attachment: AttachmentDraft, fraction: number) => {
		const row = this.rows.find((item) => item === attachment || item.id === attachment.id);
		if (row) this.progress.set(row.key, fraction);
	};

	openPicker = () => {
		this.search = '';
		this.kindFilter = 'all';
		this.picked.clear();
		this.candidate = null;
		this.pickerOpen = true;
	};

	closePicker = () => {
		this.picked.clear();
		this.candidate = null;
		this.pickerOpen = false;
	};

	/** Checks or unchecks a record in the picker. */
	toggle = (record: AttachmentsRecord) => {
		if (this.picked.has(record.id)) this.picked.delete(record.id);
		else this.picked.add(record.id);
	};

	/** Shows a record in the picker's preview without checking it. */
	previewRecord = (record: AttachmentsRecord) => {
		this.candidate = record;
	};

	/** Links the checked records to the part. */
	confirm = () => {
		const linked = this.rows.map((row) => row.id);
		const rows = [...this.picked]
			.filter((id) => !linked.includes(id))
			.map((id) => this.#record(id))
			.filter((record) => record !== undefined)
			.map((record) => this.#rowFromRecord(record));
		this.#add(rows);
		this.error = '';
		this.closePicker();
	};
}
