import PocketBase from 'pocketbase';
import type { TypedPocketBase } from './pocketbase-types.ts';

// In dev, target http://127.0.0.1:8090. In production, use relative '/' URL.
const BASE_URL = import.meta.env.DEV ? 'http://127.0.0.1:8090' : '/';

export const pb = new PocketBase(BASE_URL) as TypedPocketBase;

// Independent loads often hit the same endpoint at once (e.g. stats + full list of parts on the
// application page); the SDK's default auto-cancellation would abort all but the last of them.
pb.autoCancellation(false);

/** An absolute-path API URL; in production the client's base URL is '/', not '…/'. */
export function apiUrl(path: string) {
	return pb.baseURL === '/' ? path : `${pb.baseURL.replace(/\/$/, '')}${path}`;
}
