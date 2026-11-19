import { apiUrl, pb } from './client.ts';
import type { FootprintsRecord, SymbolsRecord } from './pocketbase-types.ts';

/*
 * Symbol and footprint previews rendered by the backend, and footprint 3D models.
 *
 * The backend renders `preview` SVGs with kicad-cli when it is installed; without it the
 * field stays empty and the UI shows "No preview available". Footprint 3D models are served
 * by `/api/footprint-model/{id}` from the library repository or KiCad's stock models.
 */

/** URL of a symbol's rendered SVG, or '' when it has none. */
export function symbolPreviewUrl(record: Pick<SymbolsRecord, 'id' | 'preview'>): string {
	if (!record.preview) return '';
	return pb.files.getURL({ ...record, collectionName: 'symbols' }, record.preview);
}

/** URL of a footprint's rendered SVG, or '' when it has none. */
export function footprintPreviewUrl(record: Pick<FootprintsRecord, 'id' | 'preview'>): string {
	if (!record.preview) return '';
	return pb.files.getURL({ ...record, collectionName: 'footprints' }, record.preview);
}

/** Answer of `GET /api/footprint-model/{id}/info`. */
export type FootprintModelInfo = {
	exists: boolean;
	/** The footprint's raw KiCad model path, e.g. `${KICAD9_3DMODEL_DIR}/…/SOT-23.step`. */
	model3d: string;
	/** File name of the model found on disk (only when `exists`). */
	filename?: string;
	format?: 'step' | 'wrl' | 'other';
};

function authHeaders(): HeadersInit {
	return pb.authStore.token ? { Authorization: pb.authStore.token } : {};
}

function modelPath(footprintId: string) {
	return apiUrl(`/api/footprint-model/${encodeURIComponent(footprintId)}`);
}

/**
 * Whether the footprint has a 3D model the backend can serve, and its file name.
 *
 * @throws an `Error` when the request fails (an `AbortError` when `signal` aborts it).
 */
export async function getFootprintModelInfo(
	footprintId: string,
	signal?: AbortSignal
): Promise<FootprintModelInfo> {
	const response = await fetch(`${modelPath(footprintId)}/info`, {
		headers: authHeaders(),
		signal
	});
	if (response.status === 404) return { exists: false, model3d: '' };
	if (!response.ok) throw new Error(`Failed to check the 3D model (${response.status}).`);
	return (await response.json()) as FootprintModelInfo;
}

/**
 * Downloads a footprint's 3D model. The route needs the auth header, so the result is a blob
 * (show it through `URL.createObjectURL` and revoke that URL when done).
 *
 * @throws an `Error` when there is no model or the request fails (an `AbortError` when
 * `signal` aborts it).
 */
export async function fetchFootprintModel(footprintId: string, signal?: AbortSignal) {
	const response = await fetch(modelPath(footprintId), { headers: authHeaders(), signal });
	if (response.status === 404) throw new Error('No 3D model available for this footprint.');
	if (!response.ok) throw new Error(`Failed to load the 3D model (${response.status}).`);
	return response.blob();
}
