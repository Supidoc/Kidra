import { ClientResponseError } from 'pocketbase';

/** Turns any thrown value into a message that can be shown to the user. */
export function errorMessage(error: unknown): string {
	if (error instanceof ClientResponseError) {
		// PocketBase puts field validation errors in `data`, e.g. { name: { message: '…' } }.
		const fieldErrors = Object.entries(error.response?.data ?? {})
			.map(([field, detail]) => `${field}: ${(detail as { message?: string })?.message ?? ''}`)
			.join(', ');
		return fieldErrors ? `${error.message} (${fieldErrors})` : error.message;
	}
	if (error instanceof Error) return error.message;
	return 'Unknown error';
}
