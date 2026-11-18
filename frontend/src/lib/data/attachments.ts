import { apiUrl, pb } from './client.ts';
import type { AttachmentsKindOptions, AttachmentsRecord } from './pocketbase-types.ts';

export type AttachmentKind = AttachmentsKindOptions;

/** The attachment kinds in display order, with their labels. */
export const attachmentKinds: { value: AttachmentKind; label: string }[] = [
	{ value: 'datasheet', label: 'Datasheet' },
	{ value: 'reference-manual', label: 'Reference manual' },
	{ value: 'app-note', label: 'App note' },
	{ value: '3d-model', label: '3D model' },
	{ value: 'image', label: 'Image' },
	{ value: 'other', label: 'Other' }
];

export function attachmentKindLabel(kind: string | undefined) {
	return attachmentKinds.find((item) => item.value === kind)?.label ?? 'Other';
}

/**
 * An attachment of the part form: an existing record (`id`), a file to upload (`file`, id
 * empty or starting with `new-`) or a link without a file (`url` only).
 */
export type AttachmentDraft = {
	id: string;
	name: string;
	url: string;
	kind: AttachmentKind;
	description: string;
	file: File | null;
};

/** How a file can be previewed. */
export type PreviewKind = 'pdf' | 'image' | '3d' | 'text' | 'none';

const MODEL_EXTENSIONS = [
	'step',
	'stp',
	'iges',
	'igs',
	'wrl',
	'vrml',
	'stl',
	'glb',
	'gltf',
	'obj',
	'3mf'
];
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'];
const TEXT_EXTENSIONS = [
	'txt',
	'md',
	'csv',
	'tsv',
	'json',
	'xml',
	'log',
	'ini',
	'yaml',
	'yml',
	'kicad_sym',
	'kicad_mod',
	'cir',
	'lib',
	'spice',
	'sp',
	'ibs'
];

/** The lower-case extension of a file name or URL path (without query), or ''. */
export function fileExtension(name: string): string {
	const path = name.split(/[?#]/)[0];
	const base = path.split('/').pop() ?? '';
	const dot = base.lastIndexOf('.');
	return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}

/** How a file can be previewed, by its extension or else its MIME type. */
export function previewKind(name: string, mime = ''): PreviewKind {
	const extension = fileExtension(name);
	if (extension === 'pdf') return 'pdf';
	if (MODEL_EXTENSIONS.includes(extension)) return '3d';
	if (IMAGE_EXTENSIONS.includes(extension)) return 'image';
	if (TEXT_EXTENSIONS.includes(extension)) return 'text';

	const type = mime.split(';')[0].trim().toLowerCase();
	if (type === 'application/pdf') return 'pdf';
	if (type.startsWith('model/') || type === 'application/step' || type === 'application/iges')
		return '3d';
	if (type.startsWith('image/')) return 'image';
	if (type.startsWith('text/') || type === 'application/json' || type === 'application/xml')
		return 'text';
	return 'none';
}

/**
 * A sensible kind for a newly added file: a PDF becomes the datasheet when the part has
 * none yet, 3D files and images get their own kind, everything else is "other".
 */
export function guessAttachmentKind(name: string, mime: string, hasDatasheet: boolean) {
	const preview = previewKind(name, mime);
	if (preview === 'pdf') return hasDatasheet ? 'other' : 'datasheet';
	if (preview === '3d') return '3d-model';
	if (preview === 'image') return 'image';
	return 'other';
}

/** The file name without its extension, used as the default attachment name. */
export function nameWithoutExtension(name: string) {
	const dot = name.lastIndexOf('.');
	return dot > 0 ? name.slice(0, dot) : name;
}

/** URL of the uploaded file of an attachment record, or '' when it has none. */
export function attachmentFileUrl(record: Pick<AttachmentsRecord, 'id' | 'file'>): string {
	if (!record.file) return '';
	return pb.files.getURL({ ...record, collectionName: 'attachments' }, record.file);
}

const EXTENSIONS_BY_MIME: Record<string, string> = {
	'application/pdf': 'pdf',
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/gif': 'gif',
	'image/webp': 'webp',
	'image/svg+xml': 'svg',
	'text/plain': 'txt',
	'text/csv': 'csv',
	'application/json': 'json',
	'application/zip': 'zip',
	'model/step': 'step',
	'model/stl': 'stl',
	'model/gltf-binary': 'glb',
	'model/gltf+json': 'gltf',
	'model/vrml': 'wrl'
};

/**
 * The file name for a download: the last URL path segment (decoded), with an extension from
 * the MIME type added when it has none. With `kind` datasheet, the name always ends in `.pdf`.
 */
export function downloadFileName(url: string, mime: string, kind?: AttachmentKind): string {
	let segment: string;
	try {
		segment = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
	} catch {
		segment = '';
	}
	segment = segment.trim() || (kind === 'datasheet' ? 'datasheet' : 'download');
	const type = mime.split(';')[0].trim().toLowerCase();
	if (kind === 'datasheet') return fileExtension(segment) === 'pdf' ? segment : `${segment}.pdf`;
	if (fileExtension(segment)) return segment;
	const extension = EXTENSIONS_BY_MIME[type];
	return extension ? `${segment}.${extension}` : segment;
}

/**
 * Downloads a file through the server's `/api/datasheet-download` proxy (avoids CORS; needs a
 * logged-in user, and the server refuses private-network URLs).
 *
 * @param kind the attachment kind; a datasheet must be a PDF.
 * @returns the file, named by {@link downloadFileName}.
 * @throws an `Error` with a user-facing message when the URL is invalid, the download
 * fails or a datasheet is not a PDF.
 */
export async function downloadAttachment(url: string, kind?: AttachmentKind): Promise<File> {
	try {
		new URL(url);
	} catch {
		throw new Error('Enter a valid URL.');
	}
	const response = await fetch(
		`${apiUrl('/api/datasheet-download')}?url=${encodeURIComponent(url)}`,
		{ headers: pb.authStore.token ? { Authorization: pb.authStore.token } : {} }
	);
	if (!response.ok) {
		const detail = (await response.text().catch(() => '')).trim();
		throw new Error(
			detail && detail.length < 200
				? `Download failed: ${detail}`
				: `Download failed (${response.status}).`
		);
	}
	const blob = await response.blob();
	const name = downloadFileName(url, blob.type, kind);
	const type =
		blob.type || (fileExtension(name) === 'pdf' ? 'application/pdf' : 'application/octet-stream');
	const file = new File([blob], name, { type });
	if (kind === 'datasheet' && previewKind(file.name, file.type) !== 'pdf') {
		throw new Error('The downloaded file is not a PDF.');
	}
	return file;
}

/** Builds the multipart body of an attachment upload. */
export function attachmentFormData(draft: AttachmentDraft): FormData {
	const body = new FormData();
	body.append('name', draft.name.trim());
	body.append('url', draft.url.trim());
	body.append('kind', draft.kind);
	body.append('description', draft.description.trim());
	if (draft.file) body.append('file', draft.file);
	return body;
}

/**
 * Creates an attachment record with its file in its own request. Uses `XMLHttpRequest`
 * because, unlike `fetch`, it reports upload progress.
 *
 * @param onProgress called with the uploaded fraction (0–1) while the file is sent.
 * @returns the created record.
 * @throws an `Error` with the server's message when the upload fails.
 */
export function uploadAttachment(
	draft: AttachmentDraft,
	onProgress?: (fraction: number) => void
): Promise<AttachmentsRecord> {
	return new Promise((resolve, reject) => {
		const request = new XMLHttpRequest();
		request.open('POST', apiUrl('/api/collections/attachments/records'));
		if (pb.authStore.token) request.setRequestHeader('Authorization', pb.authStore.token);
		request.responseType = 'json';
		request.upload.onprogress = (event) => {
			if (event.lengthComputable && event.total > 0) onProgress?.(event.loaded / event.total);
		};
		request.onload = () => {
			const body = request.response as {
				message?: string;
				data?: Record<string, { message?: string }>;
			} | null;
			if (request.status >= 200 && request.status < 300) {
				onProgress?.(1);
				resolve(body as unknown as AttachmentsRecord);
				return;
			}
			const name = draft.name || draft.file?.name || 'attachment';
			const fieldErrors = Object.entries(body?.data ?? {})
				.map(([field, error]) => `${field}: ${error?.message ?? 'invalid'}`)
				.join(', ');
			const message =
				[body?.message, fieldErrors].filter(Boolean).join(' ') || `HTTP ${request.status}`;
			reject(new Error(`Failed to upload ${name}: ${message}`));
		};
		request.onerror = () => reject(new Error('Upload failed: network error.'));
		request.onabort = () => reject(new Error('Upload aborted.'));
		request.send(attachmentFormData(draft));
	});
}
